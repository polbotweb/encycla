// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSocket, fakeIo } from './fakeSocket';
import { ME, REVEAL, jsonResponse, room } from './fixtures';
import { pinLanguage } from './language';

vi.mock('socket.io-client', () => ({ io: fakeIo }));

const { ApiClientError, api } = await import('../../client/lib/api');
const realtime = await import('../../client/lib/realtime');
const { useGameStore } = await import('../../client/store/gameStore');
const { useSessionStore } = await import('../../client/store/sessionStore');

pinLanguage('en');

const SESSION = { playerId: ME, pseudo: 'Alice', token: 'sess_t', expiresAt: Date.now() + 1e9 };

function connect(): FakeSocket {
  realtime.connectPlayerSocket('sess_t');
  const socket = FakeSocket.last();
  socket.serverEmit('connect');
  return socket;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  FakeSocket.instances = [];
  useGameStore.getState().reset();
  useSessionStore.getState().clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  realtime.disconnectPlayerSocket();
  vi.unstubAllGlobals();
});

describe('player socket', () => {
  it('connects once per token with the player auth', () => {
    realtime.connectPlayerSocket('sess_t');
    realtime.connectPlayerSocket('sess_t');
    expect(FakeSocket.instances).toHaveLength(1);
    expect(FakeSocket.last().options.auth).toEqual({ role: 'player', token: 'sess_t' });
    expect(useGameStore.getState().connection).toBe('connecting');
    FakeSocket.last().serverEmit('connect');
    expect(useGameStore.getState().connection).toBe('connected');
    expect(realtime.isSocketConnected()).toBe(true);
  });

  it('marks the session invalid on an auth error, and reconnects otherwise', () => {
    const socket = connect();
    socket.serverEmit('connect_error', Object.assign(new Error('x'), { data: { code: 'NOPE' } }));
    expect(useGameStore.getState().connection).toBe('reconnecting');
    socket.serverEmit(
      'connect_error',
      Object.assign(new Error('x'), { data: { code: 'SESSION_EXPIRED' } }),
    );
    expect(useGameStore.getState().sessionInvalid).toBe(true);
    expect(socket.disconnects).toBeGreaterThan(0);
  });

  it('reconnects after a server-side disconnect', () => {
    const socket = connect();
    socket.serverEmit('disconnect', 'io server disconnect');
    expect(useGameStore.getState().connection).toBe('reconnecting');
    expect(socket.connects).toBe(1);
  });

  it('applies room states, timer syncs, queue, proposals, closures and errors', () => {
    const socket = connect();
    socket.serverEmit('SESSION_READY', { player: { id: ME }, roomCode: null });
    expect(useGameStore.getState().playerId).toBe(ME);

    socket.serverEmit('ROOM_STATE', room('COUNTDOWN'));
    expect(useGameStore.getState().room?.phase).toBe('COUNTDOWN');
    socket.serverEmit('ROOM_STATE', room('LOBBY', { stateVersion: 11 }));
    socket.serverEmit(
      'ROOM_STATE',
      room('REVEAL', {
        stateVersion: 12,
        reveal: REVEAL,
        results: [
          {
            playerId: ME,
            choiceIndex: 1,
            correct: true,
            timedOut: false,
            responseTimeMs: 900,
            pointsAwarded: 100,
          },
        ],
      }),
    );
    expect(useGameStore.getState().room?.phase).toBe('REVEAL');
    socket.serverEmit('ROOM_STATE', room('LEVEL_COMPLETE', { stateVersion: 13 }));
    socket.serverEmit('TIMER_SYNC', {
      roomCode: 'ABCDEF',
      phase: 'LEVEL_COMPLETE',
      serverNow: Date.now(),
      phaseEndsAt: Date.now() + 1000,
      stateVersion: 13,
    });

    socket.serverEmit('SESSION_READY', { player: { id: ME }, roomCode: null });
    expect(useGameStore.getState().closedReason).toBe('SERVER_RESTART');

    socket.serverEmit('QUEUE_STATE', {
      position: 2,
      targetPlayers: 4,
      queuedAt: 1,
      proposal: null,
    });
    expect(useGameStore.getState().room).toBeNull();
    expect(useGameStore.getState().queue?.position).toBe(2);
    socket.serverEmit('SMALL_ROOM_PROPOSAL', { proposalId: 'p1', playerCount: 2, expiresAt: 9 });
    expect(useGameStore.getState().proposal).toMatchObject({
      proposalId: 'p1',
      voted: false,
    });
    socket.serverEmit('MATCH_FOUND', { roomCode: 'ABCDEF' });
    expect(useGameStore.getState().queue).toBeNull();

    socket.serverEmit('ROOM_CLOSED', { reason: 'HOST_CLOSED' });
    expect(useGameStore.getState().closedReason).toBe('HOST_CLOSED');
    socket.serverEmit('ERROR', {
      error: { code: 'RATE_LIMITED', message: 'slow', requestId: null },
    });
    expect(useGameStore.getState().lastError?.code).toBe('RATE_LIMITED');

    socket.serverEmit('SESSION_REPLACED');
    expect(useGameStore.getState().replaced).toBe(true);
    expect(useGameStore.getState().connection).toBe('offline');
    socket.serverEmit('disconnect', 'transport close');
    expect(useGameStore.getState().connection).toBe('offline');
  });
});

describe('emitAck', () => {
  it('rejects when not connected', async () => {
    await expect(realtime.emitAck('GAME_START')).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
  });

  it('resolves the ack data, and maps errors and timeouts', async () => {
    const socket = connect();
    socket.acks.set('GAME_START', { ok: true, data: { phase: 'COUNTDOWN' } });
    await expect(realtime.emitAck('GAME_START')).resolves.toEqual({ phase: 'COUNTDOWN' });
    socket.acks.set('GAME_START', {
      ok: false,
      error: { code: 'NOT_HOST', message: 'no', requestId: 'r1' },
    });
    await expect(realtime.emitAck('GAME_START')).rejects.toMatchObject({
      code: 'NOT_HOST',
      requestId: 'r1',
    });
    socket.acks.set('GAME_START', 'timeout');
    await expect(realtime.emitAck('GAME_START')).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('ensureSession', () => {
  it('creates a session, renames it, and keeps the error code on failure', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SESSION, 201));
    await realtime.ensureSession('Alice');
    expect(useSessionStore.getState().session?.token).toBe('sess_t');
    await realtime.ensureSession('Alice');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(jsonResponse({ playerId: ME, pseudo: 'Alicia' }));
    await realtime.ensureSession('Alicia');
    expect(useSessionStore.getState().session?.pseudo).toBe('Alicia');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'PATCH' });

    useSessionStore.getState().clear();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { code: 'PSEUDO_INVALID', message: 'bad' } }, 400),
    );
    await expect(realtime.ensureSession('<b>')).rejects.toBeInstanceOf(ApiClientError);
    expect(useSessionStore.getState()).toMatchObject({
      status: 'error',
      errorCode: 'PSEUDO_INVALID',
    });
  });
});

describe('gameActions', () => {
  beforeEach(() => useSessionStore.getState().setSession(SESSION));

  it('needs a session', async () => {
    useSessionStore.getState().clear();
    await expect(
      realtime.gameActions.startSolo({ mode: 'CLASSIC', category: null, difficulty: null }),
    ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('starts solo, creates and joins rooms through the API and the socket', async () => {
    const socket = connect();
    fetchMock.mockResolvedValueOnce(jsonResponse({ roomCode: 'ABCDEF', isSolo: true }, 201));
    await realtime.gameActions.startSolo({
      mode: 'CLASSIC',
      category: null,
      difficulty: null,
      language: 'ar',
    });
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).toMatchObject({ language: 'ar' });
    expect(fetchMock.mock.calls[0]?.[1].headers.Authorization).toBe('Bearer sess_t');

    fetchMock.mockResolvedValueOnce(jsonResponse({ roomCode: 'QWERTY' }, 201));
    await expect(
      realtime.gameActions.createRoom({ mode: 'CONTEST', category: null, difficulty: null }, 2),
    ).resolves.toBe('QWERTY');
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1].body)).toMatchObject({ maxPlayers: 2 });
    await realtime.gameActions.joinRoom(' abcdef ');
    expect(socket.emitted.map((entry) => entry.payload)).toEqual([
      { code: 'QWERTY' },
      { code: 'ABCDEF' },
    ]);
  });

  it('joins and leaves the queue', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ queued: true, position: 1, targetPlayers: 4, queuedAt: 5 }, 202),
    );
    await realtime.gameActions.joinQueue({ mode: 'CLASSIC', category: null, difficulty: null });
    expect(useGameStore.getState().queue).toMatchObject({ position: 1, targetPlayers: 4 });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await realtime.gameActions.leaveQueue();
    expect(useGameStore.getState().queue).toBeNull();
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'DELETE' });
  });

  it('locks an answer, and unlocks it when the server refuses', async () => {
    const socket = connect();
    useGameStore.getState().applyRoomState(room('QUESTION', { question: { ...REVEAL, id: 'q1' } }));
    await realtime.gameActions.answer('q1', 2);
    expect(useGameStore.getState().lockedChoice).toEqual({ questionId: 'q1', index: 2 });

    socket.acks.set('ANSWER', {
      ok: false,
      error: { code: 'STALE_PHASE_TOKEN', message: 'late', requestId: 'r0' },
    });
    await expect(realtime.gameActions.answer('q1', 3)).rejects.toBeInstanceOf(ApiClientError);
    expect(useGameStore.getState().lockedChoice).toBeNull();

    socket.acks.set('ANSWER', {
      ok: false,
      error: { code: 'ANSWER_ALREADY_SUBMITTED', message: 'dup', requestId: 'r0' },
    });
    await expect(realtime.gameActions.answer('q1', 1)).rejects.toBeInstanceOf(ApiClientError);
    expect(useGameStore.getState().lockedChoice).toEqual({ questionId: 'q1', index: 1 });
  });

  it('forwards host and lobby actions, votes and leaves', async () => {
    const socket = connect();
    useGameStore
      .getState()
      .setQueue({ position: 1, targetPlayers: 4, queuedAt: 1, proposal: null });
    useGameStore
      .getState()
      .setProposal({ proposalId: 'p', playerCount: 2, expiresAt: 1, voted: false });
    await realtime.gameActions.setReady(true);
    await realtime.gameActions.start();
    await realtime.gameActions.continueArticle('tok');
    await realtime.gameActions.pause();
    await realtime.gameActions.resume();
    await realtime.gameActions.skip();
    await realtime.gameActions.close();
    await realtime.gameActions.vote('p', true);
    expect(useGameStore.getState().proposal?.voted).toBe(true);
    useGameStore.getState().applyRoomState(room('LOBBY'));
    await realtime.gameActions.leaveRoom();
    expect(useGameStore.getState().room).toBeNull();
    expect(socket.emitted.map((entry) => entry.event)).toEqual([
      'LOBBY_READY',
      'GAME_START',
      'CONTINUE',
      'HOST_PAUSE',
      'HOST_RESUME',
      'HOST_SKIP',
      'HOST_CLOSE',
      'SMALL_ROOM_VOTE',
      'ROOM_LEAVE',
    ]);
  });
});

describe('waitForConnected', () => {
  it('resolves when the socket connects and rejects after the timeout', async () => {
    const waiting = realtime.waitForConnected(1000);
    connect();
    await expect(waiting).resolves.toBeUndefined();
    await expect(realtime.waitForConnected(1000)).resolves.toBeUndefined();
    realtime.disconnectPlayerSocket();
    await expect(realtime.waitForConnected(10)).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
  });
});

describe('api', () => {
  it('builds leaderboard queries and maps network errors', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ generatedAt: 1, entries: [] }));
    await api.leaderboard({ mode: 'CONTEST', source: 'web', limit: 10 });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/leaderboard?limit=10&mode=CONTEST&source=web');
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await expect(api.config()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 500 }));
    await expect(api.me('t')).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 });
  });
});
