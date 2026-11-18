import { io, type Socket } from 'socket.io-client';
import {
  GAME_NAMESPACE,
  type Ack,
  type ApiError,
  type ErrorCode,
  type TimerSync,
} from '../../shared/protocol';
import type { PublicRoomState } from '../../shared/types';
import { useGameStore, type QueueView } from '../store/gameStore';
import { useSessionStore } from '../store/sessionStore';
import { ApiClientError, api, type Selection } from './api';
import { playCue } from './audio';

let socket: Socket | null = null;
let connectedToken: string | null = null;

export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}

function handleRoomState(state: PublicRoomState): void {
  const store = useGameStore.getState();
  const previous = store.room;
  const sameRoom = previous?.roomCode === state.roomCode;
  const before = sameRoom ? previous : null;
  store.applyRoomState(state);
  if (useGameStore.getState().room !== state) {
    return;
  }
  // Audio cues only fire on genuine transitions, and never before REVEAL for answers.
  if (!before && state.phase === 'COUNTDOWN') {
    playCue('countdown-tick');
  } else if (before && before.players.length < state.players.length && state.phase === 'LOBBY') {
    playCue('lobby-join');
  } else if (before && before.phase !== state.phase) {
    if (state.phase === 'REVEAL') {
      const mine = state.results?.find((result) => result.playerId === store.playerId);
      if (mine) playCue(mine.correct ? 'correct' : 'wrong');
    } else if (state.phase === 'LEVEL_COMPLETE') {
      playCue('level-up');
    }
  }
}

export function connectPlayerSocket(token: string): void {
  if (socket && connectedToken === token) {
    return;
  }
  disconnectPlayerSocket();
  connectedToken = token;
  const game = useGameStore.getState();
  game.setConnection('connecting');

  const next = io(GAME_NAMESPACE, {
    auth: { role: 'player', token },
    transports: ['websocket', 'polling'],
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });
  socket = next;

  next.on('connect', () => useGameStore.getState().setConnection('connected'));
  next.on('connect_error', (error: Error & { data?: { code?: ErrorCode } }) => {
    const code = error.data?.code;
    if (code === 'AUTH_INVALID' || code === 'SESSION_EXPIRED' || code === 'AUTH_REQUIRED') {
      useGameStore.getState().setSessionInvalid();
      next.disconnect();
      return;
    }
    if (code === 'RATE_LIMITED') {
      // A refused handshake is not retried by Socket.io: try again shortly (D-118).
      setTimeout(
        () => {
          if (!next.connected) next.connect();
        },
        5_000 + Math.random() * 5_000,
      );
    }
    useGameStore.getState().setConnection('reconnecting');
  });
  next.on('disconnect', (reason) => {
    const state = useGameStore.getState();
    if (state.replaced) return;
    state.setConnection('reconnecting');
    if (reason === 'io server disconnect') {
      next.connect();
    }
  });
  next.on('SESSION_READY', (payload: { player: { id: string }; roomCode: string | null }) => {
    const state = useGameStore.getState();
    state.setPlayer(payload.player.id);
    if (payload.roomCode === null && state.room) {
      // The server restarted or the room is gone while we were away.
      if (state.room.phase !== 'MATCH_OVER') {
        state.setClosed('SERVER_RESTART');
      }
    }
  });
  next.on('ROOM_STATE', handleRoomState);
  next.on('TIMER_SYNC', (sync: TimerSync) => useGameStore.getState().applyTimerSync(sync));
  next.on('QUEUE_STATE', (queue: QueueView) => {
    const state = useGameStore.getState();
    // A cancelled public room sends its players back to the queue: leave the closed room view.
    if (state.room && state.closedReason) state.leaveRoomLocal();
    state.setQueue(queue);
  });
  next.on(
    'SMALL_ROOM_PROPOSAL',
    (proposal: { proposalId: string; playerCount: number; expiresAt: number }) =>
      useGameStore.getState().setProposal({ ...proposal, voted: false }),
  );
  next.on('MATCH_FOUND', () => useGameStore.getState().setQueue(null));
  next.on('ROOM_CLOSED', (payload: { reason: string }) =>
    useGameStore.getState().setClosed(payload.reason),
  );
  next.on('SESSION_REPLACED', () => {
    useGameStore.getState().setReplaced();
    useGameStore.getState().setConnection('offline');
    next.disconnect();
  });
  next.on('ERROR', (payload: { error: ApiError }) =>
    useGameStore.getState().setError(payload.error),
  );
}

export function disconnectPlayerSocket(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  connectedToken = null;
  useGameStore.getState().setConnection('offline');
}

/** Emits a socket event and resolves with the ack payload, or rejects with a typed error. */
export function emitAck<T>(event: string, payload: unknown = {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (!socket || !socket.connected) {
      reject(new ApiClientError('NOT_CONNECTED', 'Not connected', 0));
      return;
    }
    socket.timeout(8000).emit(event, payload, (timeoutError: Error | null, ack: Ack<T>) => {
      if (timeoutError) {
        reject(new ApiClientError('INTERNAL_ERROR', 'The server did not answer', 0));
      } else if (ack.ok) {
        resolve(ack.data);
      } else {
        reject(new ApiClientError(ack.error.code, ack.error.message, 0, ack.error.requestId));
      }
    });
  });
}

function token(): string {
  const session = useSessionStore.getState().session;
  if (!session) {
    throw new ApiClientError('AUTH_REQUIRED', 'No session', 401);
  }
  return session.token;
}

/** Creates the anonymous server session when the player picks a pseudo. */
export async function ensureSession(pseudo: string): Promise<void> {
  const store = useSessionStore.getState();
  if (store.session && store.session.pseudo === pseudo) {
    return;
  }
  store.setStatus('creating');
  try {
    if (store.session) {
      await api.updatePseudo(store.session.token, pseudo);
      store.setSession({ ...store.session, pseudo });
      return;
    }
    const created = await api.createSession(pseudo);
    store.setSession(created);
  } catch (error) {
    const code = error instanceof ApiClientError ? error.code : 'INTERNAL_ERROR';
    store.setStatus('error', code);
    throw error;
  }
}

export const gameActions = {
  async startSolo(selection: Selection): Promise<void> {
    await api.solo(token(), selection);
  },
  async createRoom(selection: Selection, maxPlayers?: number): Promise<string> {
    const { roomCode } = await api.createRoom(token(), selection, maxPlayers);
    await emitAck('ROOM_JOIN', { code: roomCode });
    return roomCode;
  },
  async joinRoom(code: string): Promise<void> {
    await emitAck('ROOM_JOIN', { code: code.trim().toUpperCase() });
  },
  async joinQueue(selection: Selection): Promise<void> {
    const queued = await api.joinQueue(token(), selection);
    useGameStore.getState().setQueue({
      position: queued.position,
      targetPlayers: queued.targetPlayers,
      queuedAt: queued.queuedAt,
      proposal: null,
    });
  },
  async leaveQueue(): Promise<void> {
    useGameStore.getState().setQueue(null);
    await api.leaveQueue(token());
  },
  async leaveRoom(): Promise<void> {
    try {
      await emitAck('ROOM_LEAVE');
    } finally {
      useGameStore.getState().leaveRoomLocal();
    }
  },
  setReady: (ready: boolean) => emitAck('LOBBY_READY', { ready }),
  start: () => emitAck('GAME_START'),
  async answer(questionId: string, choiceIndex: number): Promise<void> {
    useGameStore.getState().lockChoice(questionId, choiceIndex);
    try {
      await emitAck('ANSWER', { questionId, choiceIndex });
    } catch (error) {
      const code = error instanceof ApiClientError ? error.code : '';
      if (code !== 'ANSWER_ALREADY_SUBMITTED') {
        const state = useGameStore.getState();
        if (state.lockedChoice?.questionId === questionId) {
          useGameStore.setState({ lockedChoice: null });
        }
      }
      throw error;
    }
  },
  continueArticle: (phaseToken: string) => emitAck('CONTINUE', { phaseToken }),
  pause: () => emitAck('HOST_PAUSE'),
  resume: () => emitAck('HOST_RESUME'),
  skip: () => emitAck('HOST_SKIP'),
  close: () => emitAck('HOST_CLOSE'),
  async vote(proposalId: string, accept: boolean): Promise<void> {
    await emitAck('SMALL_ROOM_VOTE', { proposalId, accept });
    useGameStore.getState().markVoted();
  },
};

/** Resolves once the player socket is connected, or rejects after the timeout. */
export function waitForConnected(timeoutMs = 6000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (useGameStore.getState().connection === 'connected') {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new ApiClientError('NOT_CONNECTED', 'Not connected', 0));
    }, timeoutMs);
    const unsubscribe = useGameStore.subscribe((state) => {
      if (state.connection === 'connected') {
        clearTimeout(timer);
        unsubscribe();
        resolve();
      }
    });
  });
}
