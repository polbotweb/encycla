import { afterEach, describe, expect, it } from 'vitest';
import { startHarness, type Harness, type TestPlayer } from '../fixtures/harness';
import { SMALL_ROOM_AFTER_MS, SMALL_ROOM_VOTE_MS } from '../../server/matchmaking/QueueManager';

let harness: Harness | null = null;

afterEach(async () => {
  await harness?.close();
  harness = null;
});

function nextEvent<T>(player: TestPlayer, name: string): Promise<T> {
  return new Promise((resolve) => player.socket.once(name, resolve));
}

function queue(h: Harness, player: TestPlayer, body: unknown) {
  return h.api('/api/queue', { token: player.token, body });
}

describe('public matchmaking', () => {
  it('matches two CONTEST players immediately and auto-starts the countdown', async () => {
    harness = await startHarness();
    const h = harness;
    const alice = await h.newPlayer('Alice');
    const bob = await h.newPlayer('Bob');
    const aliceFound = nextEvent<{ roomCode: string }>(alice, 'MATCH_FOUND');
    const bobFound = nextEvent<{ roomCode: string }>(bob, 'MATCH_FOUND');

    const first = await queue(h, alice, { mode: 'CONTEST' });
    expect(first.status).toBe(202);
    expect(first.body).toMatchObject({ queued: true, position: 1, targetPlayers: 2 });
    expect((await queue(h, alice, { mode: 'CONTEST' })).body.error.code).toBe('QUEUE_ALREADY_JOINED');
    expect((await queue(h, bob, { mode: 'CONTEST' })).status).toBe(202);

    const [a, b] = await Promise.all([aliceFound, bobFound]);
    expect(a.roomCode).toBe(b.roomCode);
    const state = await alice.waitFor((s) => s.phase === 'COUNTDOWN');
    expect(state).toMatchObject({ isPublic: true, mode: 'CONTEST', roomCode: a.roomCode });

    // Public rooms are not joinable by code, and cannot be started by a player.
    const carol = await h.newPlayer('Carol');
    expect(await carol.emit('ROOM_JOIN', { code: a.roomCode })).toMatchObject({
      ok: false,
      error: { code: 'ROOM_NOT_FOUND' },
    });
    expect(await alice.emit('GAME_START')).toMatchObject({ ok: false });
    expect((await queue(h, alice, { mode: 'CONTEST' })).body.error.code).toBe('ALREADY_IN_ROOM');
  });

  it('requires a connected socket and supports leaving the queue', async () => {
    harness = await startHarness();
    const h = harness;
    const offline = await h.api('/api/sessions', { body: { pseudo: 'Ghost' } });
    expect(
      (await h.api('/api/queue', { token: offline.body.token, body: { mode: 'CLASSIC' } })).body.error
        .code,
    ).toBe('NOT_CONNECTED');

    const alice = await h.newPlayer('Alice');
    await queue(h, alice, { mode: 'CLASSIC' });
    expect(h.server.queue.size()).toBe(1);
    expect((await h.api('/api/queue', { method: 'DELETE', token: alice.token })).status).toBe(204);
    expect((await h.api('/api/queue', { method: 'DELETE', token: alice.token })).status).toBe(204);
    expect(h.server.queue.size()).toBe(0);
  });

  it('removes a player from the queue when the socket drops', async () => {
    harness = await startHarness();
    const h = harness;
    const alice = await h.newPlayer('Alice');
    await queue(h, alice, { mode: 'CLASSIC' });
    alice.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(h.server.queue.size()).toBe(0);
  });

  it('starts a classic room with 4 players at once', async () => {
    harness = await startHarness();
    const h = harness;
    const players = await Promise.all(['A1', 'B2', 'C3', 'D4'].map((n) => h.newPlayer(n)));
    const found = players.map((p) => nextEvent<{ roomCode: string }>(p, 'MATCH_FOUND'));
    for (const player of players) {
      await queue(h, player, { mode: 'CLASSIC' });
    }
    const codes = await Promise.all(found);
    expect(new Set(codes.map((c) => c.roomCode)).size).toBe(1);
  });

  it('proposes a small room after 120 s and starts it on a strict majority', async () => {
    harness = await startHarness();
    const h = harness;
    const [a, b, c] = await Promise.all(['Aa', 'Bb', 'Cc'].map((n) => h.newPlayer(n)));
    const proposals = [a!, b!, c!].map((p) =>
      nextEvent<{ proposalId: string; playerCount: number }>(p, 'SMALL_ROOM_PROPOSAL'),
    );
    for (const player of [a!, b!, c!]) {
      await queue(h, player, { mode: 'CLASSIC' });
    }
    h.clock.advance(SMALL_ROOM_AFTER_MS - 1);
    h.server.queue.sweep();
    expect(h.server.queue.size()).toBe(3);

    h.clock.advance(1);
    h.server.queue.sweep();
    const [proposal] = await Promise.all(proposals);
    expect(proposal!.playerCount).toBe(3);

    const found = [a!, b!].map((p) => nextEvent<{ roomCode: string }>(p, 'MATCH_FOUND'));
    expect(await a!.emit('SMALL_ROOM_VOTE', { proposalId: proposal!.proposalId, accept: true })).toMatchObject({ ok: true });
    expect(await b!.emit('SMALL_ROOM_VOTE', { proposalId: proposal!.proposalId, accept: true })).toMatchObject({ ok: true });
    // Carol stays silent: counted as a refusal, 2 of 3 is a strict majority.
    h.clock.advance(SMALL_ROOM_VOTE_MS);
    h.server.queue.sweep();
    const [roomA] = await Promise.all(found);
    const state = await a!.waitFor((s) => s.roomCode === roomA!.roomCode && s.phase === 'COUNTDOWN');
    expect(state.players).toHaveLength(2);
    expect(h.server.queue.size()).toBe(1);
    expect(h.server.queue.isQueued(c!.playerId)).toBe(true);
  });

  it('keeps everyone in the queue and resets the timer when the vote fails', async () => {
    harness = await startHarness();
    const h = harness;
    const [a, b] = await Promise.all(['Aa', 'Bb'].map((n) => h.newPlayer(n)));
    const proposal = nextEvent<{ proposalId: string }>(a!, 'SMALL_ROOM_PROPOSAL');
    await queue(h, a!, { mode: 'SUBJECT', category: 'Fauna', difficulty: 'Novice' });
    await queue(h, b!, { mode: 'SUBJECT', category: 'Fauna', difficulty: 'Novice' });
    h.clock.advance(SMALL_ROOM_AFTER_MS);
    h.server.queue.sweep();
    const { proposalId } = await proposal;
    await a!.emit('SMALL_ROOM_VOTE', { proposalId, accept: true });
    expect(await b!.emit('SMALL_ROOM_VOTE', { proposalId: 'nope', accept: true })).toMatchObject({
      ok: false,
      error: { code: 'PROPOSAL_NOT_FOUND' },
    });
    await b!.emit('SMALL_ROOM_VOTE', { proposalId, accept: false });
    expect(h.server.queue.size()).toBe(2);
    // timer was reset: no new proposal until another 120 s elapsed
    h.clock.advance(SMALL_ROOM_AFTER_MS - 1);
    h.server.queue.sweep();
    expect(h.server.queue.size()).toBe(2);
  });
});
