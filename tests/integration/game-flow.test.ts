import { afterEach, describe, expect, it } from 'vitest';
import type { PublicRoomState } from '../../shared/types';
import { startHarness, type Harness, type TestPlayer } from '../fixtures/harness';

let harness: Harness | null = null;

afterEach(async () => {
  await harness?.close();
  harness = null;
});

async function advance(h: Harness, ms: number): Promise<void> {
  h.clock.advance(ms);
  h.server.manager.sweep();
}

async function answerQuestion(h: Harness, players: TestPlayer[], state: PublicRoomState) {
  const question = state.question!;
  for (const player of players) {
    const ack = await player.emit<{ lockedIn: boolean }>('ANSWER', {
      questionId: question.id,
      choiceIndex: 0,
    });
    expect(ack).toMatchObject({ ok: true, data: { lockedIn: true } });
  }
  return players[0]!.waitFor((s) => s.phase === 'REVEAL' && s.stateVersion > state.stateVersion);
}

describe('private CONTEST room end to end', () => {
  it('plays a full match, never leaks answers early and persists the leaderboard', async () => {
    harness = await startHarness();
    const h = harness;
    const alice = await h.newPlayer('Alice');
    const bob = await h.newPlayer('Bob');

    const created = await h.api('/api/rooms', { token: alice.token, body: { mode: 'CONTEST' } });
    expect(created.status).toBe(201);
    const code = created.body.roomCode as string;

    expect(await alice.emit('ROOM_JOIN', { code })).toMatchObject({ ok: true });
    expect(await bob.emit('ROOM_JOIN', { code })).toMatchObject({
      ok: true,
      data: { roomCode: code },
    });
    expect((await alice.waitFor((s) => s.players.length === 2)).phase).toBe('LOBBY');

    expect(await alice.emit('GAME_START')).toMatchObject({
      ok: false,
      error: { code: 'PLAYERS_NOT_READY' },
    });
    expect(await bob.emit('GAME_START')).toMatchObject({ ok: false, error: { code: 'NOT_HOST' } });
    await alice.emit('LOBBY_READY', { ready: true });
    await bob.emit('LOBBY_READY', { ready: true });
    expect(await alice.emit('GAME_START')).toMatchObject({
      ok: true,
      data: { phase: 'COUNTDOWN' },
    });

    await advance(h, 3000);
    let state = await alice.waitFor((s) => s.phase === 'QUESTION');
    for (let index = 0; index < 10; index += 1) {
      // no answer before REVEAL
      expect(state.reveal === null || state.reveal.questionId !== state.question!.id).toBe(true);
      expect(JSON.stringify(state.question)).not.toContain('correctIndex');

      const reveal = await answerQuestion(h, [alice, bob], state);
      expect(reveal.reveal?.correctIndex).toBeGreaterThanOrEqual(0);
      expect(reveal.results).toHaveLength(2);

      await advance(h, 2500);
      const article = await alice.waitFor((s) => s.phase === 'ARTICLE' || s.phase === 'MATCH_OVER');
      if (article.phase === 'MATCH_OVER') {
        break;
      }
      for (const player of [alice, bob]) {
        const ack = await player.emit('CONTINUE', { phaseToken: article.phaseToken });
        expect(ack, JSON.stringify(ack)).toMatchObject({ ok: true });
      }
      const nextVersion = article.stateVersion;
      state = await alice.waitFor(
        (s) => s.stateVersion > nextVersion && (s.phase === 'QUESTION' || s.phase === 'MATCH_OVER'),
      );
      if (state.phase === 'MATCH_OVER') {
        break;
      }
    }

    // The last REVEAL leads to ARTICLE (natural end) then MATCH_OVER on CONTINUE.
    let current = alice.last()!;
    if (current.phase === 'ARTICLE') {
      for (const player of [alice, bob]) {
        await player.emit('CONTINUE', { phaseToken: current.phaseToken });
      }
      current = await alice.waitFor((s) => s.phase === 'MATCH_OVER');
    }
    expect(current.phase).toBe('MATCH_OVER');
    expect(current.finalRanking).toHaveLength(2);

    const leaderboard = await h.api('/api/leaderboard');
    expect(leaderboard.status).toBe(200);
    expect(leaderboard.body.entries.length).toBeGreaterThanOrEqual(1);
  }, 30_000);
});

describe('socket guards', () => {
  it('rejects unknown tokens and exposes typed errors', async () => {
    harness = await startHarness();
    const { io } = await import('socket.io-client');
    const bad = io(`${harness.baseUrl}/game`, {
      auth: { role: 'player', token: 'sess_nope' },
      transports: ['websocket'],
      reconnection: false,
    });
    const error = await new Promise<{ data?: { code: string } }>((resolve) =>
      bad.once('connect_error', resolve),
    );
    expect(error.data?.code).toBe('AUTH_INVALID');
    bad.disconnect();

    const alice = await harness.newPlayer('Alice');
    expect(await alice.emit('ROOM_JOIN', { code: 'ZZZZZZ' })).toMatchObject({
      ok: false,
      error: { code: 'ROOM_NOT_FOUND' },
    });
    expect(await alice.emit('ROOM_JOIN', { nope: 1 })).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(await alice.emit('ANSWER', { questionId: 'x', choiceIndex: 0 })).toMatchObject({
      ok: false,
      error: { code: 'NOT_IN_ROOM' },
    });
  });

  it('replaces an older socket for the same session', async () => {
    harness = await startHarness();
    const alice = await harness.newPlayer('Alice');
    const { io } = await import('socket.io-client');
    const second = io(`${harness.baseUrl}/game`, {
      auth: { role: 'player', token: alice.token },
      transports: ['websocket'],
      reconnection: false,
    });
    await new Promise<void>((resolve) => second.once('SESSION_READY', () => resolve()));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(alice.events.some((event) => event.name === 'SESSION_REPLACED')).toBe(true);
    expect(alice.socket.connected).toBe(false);
    second.disconnect();
  });
});

describe('solo and HTTP contract', () => {
  it('starts a solo room when the socket is connected, and refuses CONTEST solo', async () => {
    harness = await startHarness();
    const h = harness;
    const alice = await h.newPlayer('Alice');

    const contest = await h.api('/api/solo', { token: alice.token, body: { mode: 'CONTEST' } });
    expect(contest.status).toBe(400);
    expect(contest.body.error.code).toBe('VALIDATION_ERROR');
    expect(contest.body.error.requestId).toBeTruthy();

    const solo = await h.api('/api/solo', { token: alice.token, body: { mode: 'CLASSIC' } });
    expect(solo.status).toBe(201);
    expect(solo.body.isSolo).toBe(true);
    const state = await alice.waitFor((s) => s.phase === 'COUNTDOWN');
    expect(state.isSolo).toBe(true);

    const again = await h.api('/api/solo', { token: alice.token, body: { mode: 'CLASSIC' } });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_IN_ROOM');
  });

  it('needs a connected socket for solo', async () => {
    harness = await startHarness();
    const session = await harness.api('/api/sessions', { body: { pseudo: 'Offline' } });
    const response = await harness.api('/api/solo', {
      token: session.body.token,
      body: { mode: 'CLASSIC' },
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('NOT_CONNECTED');
  });

  it('validates room creation per mode and category size', async () => {
    harness = await startHarness();
    const alice = await harness.newPlayer('Alice');
    const call = (body: unknown) => harness!.api('/api/rooms', { token: alice.token, body });

    expect((await call({ mode: 'CLASSIC', category: 'Fauna' })).body.error.code).toBe(
      'VALIDATION_ERROR',
    );
    expect((await call({ mode: 'SUBJECT' })).body.error.code).toBe('VALIDATION_ERROR');
    expect(
      (await call({ mode: 'SUBJECT', category: 'Music', difficulty: 'Novice' })).body.error.code,
    ).toBe('CATEGORY_INSUFFICIENT_QUESTIONS');
    const ok = await call({
      mode: 'SUBJECT',
      category: 'Fauna',
      difficulty: 'Wizard',
      maxPlayers: 4,
    });
    expect(ok.status).toBe(201);
    expect(ok.body.roomCode).toMatch(/^[A-Z2-9]{6}$/);
  });

  it('serves config, protects admin routes and closes a room on admin request', async () => {
    harness = await startHarness();
    const h = harness;
    const config = await h.api('/api/config');
    expect(config.body.protocolVersion).toBe(1);
    expect(
      config.body.categories.find((c: { value: string }) => c.value === 'Fauna'),
    ).toMatchObject({
      subjectEnabled: true,
    });
    expect(
      config.body.categories.find((c: { value: string }) => c.value === 'Music'),
    ).toMatchObject({
      subjectEnabled: false,
    });

    const alice = await h.newPlayer('Alice');
    const created = await h.api('/api/rooms', { token: alice.token, body: { mode: 'CLASSIC' } });
    const code = created.body.roomCode as string;

    expect((await h.api(`/api/admin/rooms/${code}/close`, { method: 'POST' })).status).toBe(401);
    expect(
      (await h.api(`/api/admin/rooms/${code}/close`, { method: 'POST', token: alice.token }))
        .status,
    ).toBe(403);
    expect(
      (
        await h.api(`/api/admin/rooms/${code}/close`, {
          method: 'POST',
          token: 'admin-secret-for-tests',
        })
      ).status,
    ).toBe(204);
    expect(h.server.manager.hasRoom(code)).toBe(false);
    expect((await h.api('/api/leaderboard?limit=0')).status).toBe(400);
  });
});

describe('reconnection', () => {
  it('restores the snapshot after a socket drop within the grace window', async () => {
    harness = await startHarness();
    const h = harness;
    const alice = await h.newPlayer('Alice');
    const bob = await h.newPlayer('Bob');
    const code = (await h.api('/api/rooms', { token: alice.token, body: { mode: 'CLASSIC' } })).body
      .roomCode as string;
    await alice.emit('ROOM_JOIN', { code });
    await bob.emit('ROOM_JOIN', { code });
    await alice.waitFor((s) => s.players.length === 2);

    bob.disconnect();
    await alice.waitFor((s) =>
      s.players.some((p) => p.id === bob.playerId && p.status === 'DISCONNECTED'),
    );

    const { io } = await import('socket.io-client');
    const again = io(`${h.baseUrl}/game`, {
      auth: { role: 'player', token: bob.token },
      transports: ['websocket'],
      reconnection: false,
    });
    const readyPromise = new Promise<{ roomCode: string | null }>((resolve) =>
      again.once('SESSION_READY', resolve),
    );
    const snapshotPromise = new Promise<PublicRoomState>((resolve) =>
      again.once('ROOM_STATE', resolve),
    );
    const ready = await readyPromise;
    expect(ready.roomCode).toBe(code);
    const snapshot = await snapshotPromise;
    expect(snapshot.roomCode).toBe(code);
    await alice.waitFor((s) => s.players.every((p) => p.status === 'CONNECTED'));
    again.disconnect();
  });
});
