import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io as connect } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import type { GameState } from '../../server/game/types';
import {
  MemoryRoomSnapshotRepository,
  RESTORE_MAX_AGE_MS,
  restorableSnapshots,
} from '../../server/persistence/roomSnapshots';
import { RESTORE_GRACE_MS } from '../../server/rooms/RoomManager';
import { makeClock, startHarness, type Harness } from '../fixtures/harness';

let harnesses: Harness[] = [];

afterEach(async () => {
  for (const harness of harnesses) await harness.close().catch(() => undefined);
  harnesses = [];
});

describe('rooms survive a graceful restart (D-117)', () => {
  it('restores a running match: same code, players reconnect with their session, match kept', async () => {
    const databasePath = join(mkdtempSync(join(tmpdir(), 'encycla-restart-')), 'encycla.db');
    const clock = makeClock();
    const first = await startHarness({}, { databasePath, clock });
    const alice = await first.newPlayer('Alice');
    const bob = await first.newPlayer('Bob');
    const created = await first.api('/api/rooms', {
      token: alice.token,
      body: { mode: 'CONTEST' },
    });
    const code = created.body.roomCode as string;
    await alice.emit('ROOM_JOIN', { code });
    await bob.emit('ROOM_JOIN', { code });
    await alice.emit('LOBBY_READY', { ready: true });
    await bob.emit('LOBBY_READY', { ready: true });
    await alice.emit('GAME_START');
    clock.advance(3000);
    first.server.manager.sweep();
    const question = await alice.waitFor((s) => s.phase === 'QUESTION');
    await alice.emit('ANSWER', { questionId: question.question!.id, choiceIndex: 1 });
    const before = first.server.manager.getState(code)!;

    alice.disconnect();
    bob.disconnect();
    await first.server.close({ preserveRooms: true });
    first.server.persistence.close();

    clock.advance(4000);
    const second = await startHarness({ restoreRooms: true }, { databasePath, clock });
    harnesses.push(second);
    const restored = second.server.manager.getState(code)!;
    expect(restored.phase).toBe('QUESTION');
    expect(restored.matchId).toBe(before.matchId);
    expect(restored.phaseEndsAt).toBe(before.phaseEndsAt! + 4000 + RESTORE_GRACE_MS);
    expect(Object.values(restored.players).map((p) => p.status)).toEqual([
      'DISCONNECTED',
      'DISCONNECTED',
    ]);
    expect(restored.players[alice.playerId]?.answer?.choiceIndex).toBe(
      before.players[alice.playerId]?.answer?.choiceIndex,
    );
    const match = second.server.persistence
      .db!.prepare('SELECT status FROM matches WHERE id = ?')
      .get(before.matchId) as { status: string };
    expect(match.status).toBe('in_progress');

    // Alice comes back with the token she already had.
    const socket = connect(`${second.baseUrl}/game`, {
      auth: { role: 'player', token: alice.token },
      transports: ['websocket'],
      reconnection: false,
    });
    const ready = await new Promise<{ roomCode: string | null }>((resolve, reject) => {
      socket.once('SESSION_READY', resolve);
      socket.once('connect_error', reject);
    });
    socket.disconnect();
    expect(ready.roomCode).toBe(code);
    expect(second.server.manager.getState(code)?.players[alice.playerId]?.status).toBeDefined();
  });

  it('closes rooms on a plain close, and never keeps TikTok, finished or stale rooms', async () => {
    const harness = await startHarness();
    harnesses.push(harness);
    const alice = await harness.newPlayer('Alice');
    const created = await harness.api('/api/rooms', {
      token: alice.token,
      body: { mode: 'CONTEST' },
    });
    const code = created.body.roomCode as string;
    await alice.emit('ROOM_JOIN', { code });
    harness.server.manager.flushSnapshots();
    expect(harness.server.persistence.rooms.list().map((s) => s.roomCode)).toEqual([code]);
    harness.server.manager.forceClose(code, 'ADMIN_CLOSED');
    expect(harness.server.persistence.rooms.list()).toEqual([]);

    const base = { roomCode: 'ABCDEF', isTikTok: false, phase: 'QUESTION', closedReason: null };
    const repo = new MemoryRoomSnapshotRepository();
    const now = 10_000_000;
    repo.save('ABCDEF', JSON.stringify(base), now - 1000);
    repo.save('TIKTOK', JSON.stringify({ ...base, roomCode: 'TIKTOK', isTikTok: true }), now);
    repo.save('ENDED1', JSON.stringify({ ...base, roomCode: 'ENDED1', phase: 'MATCH_OVER' }), now);
    repo.save(
      'STALE1',
      JSON.stringify({ ...base, roomCode: 'STALE1' }),
      now - RESTORE_MAX_AGE_MS - 1,
    );
    repo.save('BROKEN', '{not json', now);
    repo.save('OTHER1', JSON.stringify(base), now);
    expect(
      restorableSnapshots(repo.list(), now).map((entry) => (entry.state as GameState).roomCode),
    ).toEqual(['ABCDEF']);
    repo.delete('ABCDEF');
    expect(repo.list()).toHaveLength(5);
  });
});
