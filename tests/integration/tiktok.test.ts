import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import type { Ack } from '../../shared/protocol';
import type { PublicRoomState } from '../../shared/types';
import { FakeTikTokAdapter } from '../../server/tiktok/fakeAdapter';
import { startHarness, type Harness } from '../fixtures/harness';

let harness: Harness | null = null;
const sockets: Socket[] = [];

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.disconnect();
  await harness?.close();
  harness = null;
});

const ADMIN = 'admin-secret-for-tests';
const until = async (predicate: () => boolean, timeoutMs = 2000): Promise<void> => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

interface RoleClient {
  socket: Socket;
  states: PublicRoomState[];
  events: string[];
  emit<T = unknown>(event: string, payload?: unknown): Promise<Ack<T>>;
}

async function roleClient(
  h: Harness,
  role: 'overlay' | 'control',
  roomCode: string,
  token: string,
): Promise<RoleClient> {
  const socket = connect(`${h.baseUrl}/game`, {
    auth: { role, roomCode, token },
    transports: ['websocket'],
    reconnection: false,
  });
  sockets.push(socket);
  const states: PublicRoomState[] = [];
  const events: string[] = [];
  socket.onAny((name) => events.push(name));
  socket.on('ROOM_STATE', (state: PublicRoomState) => states.push(state));
  await new Promise<void>((resolve, reject) => {
    socket.once('ROOM_STATE', () => resolve());
    socket.once('connect_error', reject);
  });
  return {
    socket,
    states,
    events,
    emit: (event, payload) => new Promise((resolve) => socket.emit(event, payload ?? {}, resolve)),
  };
}

async function start() {
  const fake = new FakeTikTokAdapter();
  harness = await startHarness({ tiktokAdapterFactory: () => fake, tiktokDefaultTarget: 'game' });
  await until(() => harness!.server.tiktok.isConnected());
  return { h: harness, fake };
}

async function createRoom(h: Harness, body: unknown = { mode: 'CLASSIC' }) {
  return h.api('/api/tiktok/rooms', { token: ADMIN, body });
}

describe('POST /api/tiktok/rooms', () => {
  it('requires the admin token', async () => {
    const { h } = await start();
    expect((await h.api('/api/tiktok/rooms', { body: { mode: 'CLASSIC' } })).status).toBe(401);
    const wrong = await h.api('/api/tiktok/rooms', { token: 'nope', body: { mode: 'CLASSIC' } });
    expect(wrong.status).toBe(403);
  });

  it('creates a room with overlay and control tokens and validates the body', async () => {
    const { h } = await start();
    const created = await createRoom(h, { mode: 'CLASSIC', timerMs: 12_000 });
    expect(created.status).toBe(201);
    expect(created.body.roomCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(created.body.overlayToken).toMatch(/^ovl_/);
    expect(created.body.controlToken).toMatch(/^ctl_/);
    const state = h.server.manager.getPublicState(created.body.roomCode)!;
    expect(state).toMatchObject({ isTikTok: true, tiktokConnected: true, hostId: null });
    expect(state.settings.maxPlayers).toBe(100);
    expect(state.settings.timerMs).toBe(12_000);

    expect((await createRoom(h, { mode: 'CLASSIC' })).body.error.code).toBe('ROOM_IN_PROGRESS');
  });

  it.each([
    [{ mode: 'CONTEST' }],
    [{ mode: 'CLASSIC', category: 'Fauna' }],
    [{ mode: 'SUBJECT' }],
    [{ mode: 'CLASSIC', timerMs: 5000 }],
    [{ mode: 'CLASSIC', timerMs: 31_000 }],
    [{ mode: 'CLASSIC', extra: 1 }],
  ])('rejects %j', async (body) => {
    const { h } = await start();
    const response = await createRoom(h, body);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts SUBJECT only for a category with enough questions', async () => {
    const { h } = await start();
    const ok = await createRoom(h, { mode: 'SUBJECT', category: 'Fauna', difficulty: 'Novice' });
    expect(ok.status).toBe(201);
  });

  it('answers TIKTOK_DISABLED when no connector is configured', async () => {
    harness = await startHarness();
    const response = await harness.api('/api/tiktok/rooms', {
      token: ADMIN,
      body: { mode: 'CLASSIC' },
    });
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('TIKTOK_DISABLED');
  });

  it('answers TIKTOK_NOT_CONNECTED while the connector is offline, and health degrades', async () => {
    const fake = new FakeTikTokAdapter();
    fake.failNextConnects = 100;
    harness = await startHarness({ tiktokAdapterFactory: () => fake, tiktokDefaultTarget: 'game' });
    const response = await createRoom(harness);
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('TIKTOK_NOT_CONNECTED');
    const health = await harness.api('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('degraded');
  });
});

describe('any live, streamer status and simulated chat', () => {
  it('follows the live a room names and reports it to the streamer console', async () => {
    const targets: string[] = [];
    harness = await startHarness({
      tiktokAdapterFactory: (target) => {
        targets.push(target);
        return new FakeTikTokAdapter();
      },
    });
    const h = harness;
    expect((await h.api('/api/admin/tiktok')).status).toBe(401);
    const idle = await h.api('/api/admin/tiktok', { token: ADMIN, method: 'GET' });
    expect(idle.body).toEqual({
      enabled: true,
      simulated: false,
      connected: false,
      liveUsername: null,
      activeRoomCode: null,
    });
    const missing = await createRoom(h);
    expect(missing.body.error.code).toBe('VALIDATION_ERROR');
    const bad = await createRoom(h, { mode: 'CLASSIC', liveUsername: 'not a handle' });
    expect(bad.status).toBe(400);

    const created = await createRoom(h, { mode: 'CLASSIC', liveUsername: '@Any.Live' });
    expect(created.status).toBe(201);
    expect(created.body.liveUsername).toBe('any.live');
    expect(targets).toEqual(['any.live']);
    await until(() => h.server.tiktok.isConnected());
    const status = await h.api('/api/admin/tiktok', { token: ADMIN, method: 'GET' });
    expect(status.body).toMatchObject({
      connected: true,
      liveUsername: 'any.live',
      activeRoomCode: created.body.roomCode,
    });
    // The simulated chat endpoint stays closed with a real adapter.
    const chat = await h.api('/api/admin/tiktok/chat', {
      token: ADMIN,
      body: { uniqueId: 'viewer', comment: 'A' },
    });
    expect(chat.status).toBe(503);
  });

  it('feeds simulated chat answers into the room with TIKTOK_ADAPTER=fake', async () => {
    harness = await startHarness({
      tiktokAdapterFactory: () => new FakeTikTokAdapter(),
      tiktokDefaultTarget: 'demo',
      tiktokSimulated: true,
    });
    const h = harness;
    await until(() => h.server.tiktok.isConnected());
    const created = await createRoom(h);
    expect(created.body).toMatchObject({ liveUsername: 'demo', connected: true });
    const control = await roleClient(
      h,
      'control',
      created.body.roomCode,
      created.body.controlToken,
    );
    await control.emit('GAME_START');
    h.clock.advance(3000);
    h.server.manager.sweep();
    await until(() => control.states.at(-1)?.phase === 'QUESTION');
    const say = (body: unknown) => h.api('/api/admin/tiktok/chat', { token: ADMIN, body });
    expect((await say({ uniqueId: 'alice_1', nickname: 'Alice', comment: 'B' })).status).toBe(202);
    expect((await say({ uniqueId: 'bad id!', comment: 'B' })).status).toBe(400);
    expect((await say({ uniqueId: 'bob', comment: 'A' })).status).toBe(202);
    const code = created.body.roomCode as string;
    await until(() => h.server.manager.getState(code)!.joinedPlayerCount === 2);
    const names = Object.values(h.server.manager.getState(code)!.players).map((p) => p.displayName);
    expect(names.sort()).toEqual(['Alice', 'bob']);
  });
});

describe('TikTok room end to end', () => {
  it('keeps the overlay read-only and rejects wrong tokens', async () => {
    const { h } = await start();
    const created = (await createRoom(h)).body;
    const overlay = await roleClient(h, 'overlay', created.roomCode, created.overlayToken);

    for (const event of ['GAME_START', 'HOST_PAUSE', 'HOST_SKIP', 'HOST_CLOSE']) {
      const ack = await overlay.emit(event);
      expect(ack).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    }
    expect(
      await overlay.emit('HOST_MANUAL_ANSWER', { playerId: 'x', choiceIndex: 0 }),
    ).toMatchObject({ ok: false });

    // an overlay token cannot open the control role and vice versa
    const bad = connect(`${h.baseUrl}/game`, {
      auth: { role: 'control', roomCode: created.roomCode, token: created.overlayToken },
      transports: ['websocket'],
      reconnection: false,
    });
    sockets.push(bad);
    await expect(
      new Promise((_resolve, reject) => bad.once('connect_error', reject)),
    ).rejects.toMatchObject({ data: { code: 'AUTH_INVALID' } });
  });

  it('plays a question from chat: strict parsing, dedupe, capacity of 100, manual answer, auto article', async () => {
    const { h, fake } = await start();
    const created = (await createRoom(h)).body;
    const code = created.roomCode as string;
    const overlay = await roleClient(h, 'overlay', code, created.overlayToken);
    const control = await roleClient(h, 'control', code, created.controlToken);
    expect(control.events).toContain('CONTROL_READY');

    expect(await control.emit('GAME_START')).toMatchObject({ ok: true });
    h.clock.advance(3000);
    h.server.manager.sweep();
    await until(() => overlay.states.at(-1)?.phase === 'QUESTION');
    const question = overlay.states.at(-1)!.question!;
    expect(JSON.stringify(question)).not.toContain('correctIndex');

    // ignored: not an answer / viewer not yet seated
    fake.say('lurker', 'bonjour');
    fake.say('lurker', 'réponse A');
    fake.say('lurker', 'https://x.test A');
    expect(h.server.manager.getState(code)!.joinedPlayerCount).toBe(0);

    // 100 viewers answer; first answer counts, duplicates ignored
    for (let index = 0; index < 100; index += 1) {
      fake.say(`viewer${index}`, index % 2 === 0 ? 'A' : '@streamer b', `Viewer ${index}`);
    }
    fake.say('viewer0', 'C');
    fake.say('viewer101', 'A'); // 101st unique viewer: over capacity
    const state = h.server.manager.getState(code)!;
    // viewers join by answering, so the question keeps running until its timer
    expect(state.phase).toBe('QUESTION');
    expect(state.joinedPlayerCount).toBe(100);
    expect(Object.keys(state.players)).toHaveLength(100);
    h.clock.advance(15_000);
    h.server.manager.sweep();

    await until(() => overlay.states.at(-1)?.phase === 'REVEAL');
    const reveal = overlay.states.at(-1)!;
    expect(reveal.players).toHaveLength(100);
    const first = reveal.results!.find(
      (result) => result.playerId === reveal.players.find((p) => p.displayName === 'Viewer 0')!.id,
    )!;
    expect(first.choiceIndex).toBe(0);
    expect(Buffer.byteLength(JSON.stringify(reveal))).toBeLessThan(64 * 1024);

    // article auto-advances after 8 s with nobody pressing Continue
    h.clock.advance(2_500);
    h.server.manager.sweep();
    expect(h.server.manager.getState(code)!.phase).toBe('ARTICLE');
    h.clock.advance(8_000);
    h.server.manager.sweep();
    await until(() => overlay.states.at(-1)?.phase === 'QUESTION');
    expect(overlay.states.at(-1)!.questionIndex).toBe(1);
  });

  it('lets the control answer on behalf of a viewer and skip a question', async () => {
    const { h, fake } = await start();
    const created = (await createRoom(h)).body;
    const code = created.roomCode as string;
    const control = await roleClient(h, 'control', code, created.controlToken);
    await control.emit('GAME_START');
    h.clock.advance(3000);
    h.server.manager.sweep();
    await until(() => h.server.manager.getState(code)!.phase === 'QUESTION');

    fake.say('alice', 'A', 'Alice'); // seats Alice and answers
    fake.say('bob', 'A', 'Bob');
    expect(h.server.manager.getState(code)!.phase).toBe('QUESTION');
    expect(await control.emit('HOST_SKIP')).toMatchObject({ ok: true });
    expect(h.server.manager.getState(code)!.phase).toBe('REVEAL');

    // next question: reveal 2.5 s, article 8 s
    h.clock.advance(2_500);
    h.server.manager.sweep();
    h.clock.advance(8_000);
    h.server.manager.sweep();
    await until(() => h.server.manager.getState(code)!.phase === 'QUESTION');
    const bobId = Object.values(h.server.manager.getState(code)!.players).find(
      (p) => p.displayName === 'Bob',
    )!.id;
    const ack = await control.emit('HOST_MANUAL_ANSWER', { playerId: bobId, choiceIndex: 1 });
    expect(ack).toMatchObject({ ok: true, data: { accepted: true } });
    expect(
      await control.emit('HOST_MANUAL_ANSWER', { playerId: bobId, choiceIndex: 2 }),
    ).toMatchObject({
      ok: false,
      error: { code: 'ANSWER_ALREADY_SUBMITTED' },
    });
    expect(
      await control.emit('HOST_MANUAL_ANSWER', { playerId: 'nobody', choiceIndex: 2 }),
    ).toMatchObject({
      ok: false,
      error: { code: 'PLAYER_NOT_FOUND' },
    });
  });

  it('reflects connector drops in tiktokConnected, pauses at the next safe point and recovers', async () => {
    const { h, fake } = await start();
    const created = (await createRoom(h)).body;
    const code = created.roomCode as string;
    const overlay = await roleClient(h, 'overlay', code, created.overlayToken);
    const control = await roleClient(h, 'control', code, created.controlToken);
    await control.emit('GAME_START');
    h.clock.advance(3000);
    h.server.manager.sweep();
    await until(() => overlay.states.at(-1)?.phase === 'QUESTION');

    fake.drop();
    await until(() => overlay.states.at(-1)?.tiktokConnected === false);
    expect(overlay.states.at(-1)!.phase).toBe('PAUSED');

    // the connector reconnects on its own (1 s backoff) but the room stays paused
    await until(() => overlay.states.at(-1)?.tiktokConnected === true, 3000);
    expect(h.server.manager.getState(code)!.phase).toBe('PAUSED');
    fake.say('early', 'A', 'Early');
    expect(h.server.manager.getState(code)!.joinedPlayerCount).toBe(0);

    // the operator resumes; chat answers count again
    expect(await control.emit('HOST_RESUME')).toMatchObject({ ok: true });
    fake.say('late', 'A', 'Late');
    expect(h.server.manager.getState(code)!.joinedPlayerCount).toBe(1);
  });

  it('closes cleanly: tokens revoked and the live slot is freed', async () => {
    const { h, fake } = await start();
    const created = (await createRoom(h)).body;
    const code = created.roomCode as string;
    const control = await roleClient(h, 'control', code, created.controlToken);
    await control.emit('GAME_START');
    h.clock.advance(3000);
    h.server.manager.sweep();
    await until(() => h.server.manager.getState(code)!.phase === 'QUESTION');
    fake.say('alice', 'A', 'Alice');
    expect(h.server.manager.getState(code)!.joinedPlayerCount).toBe(1);
    expect(await control.emit('HOST_CLOSE')).toMatchObject({ ok: true });
    await until(() => !h.server.manager.hasRoom(code));
    // tokens are revoked with the room, a new room can be created
    expect(h.server.roomTokens.has(code)).toBe(false);
    expect((await createRoom(h)).status).toBe(201);
  });
});
