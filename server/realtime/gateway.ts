import type { Server as HttpServer } from 'node:http';
import { Server, type Namespace, type Socket } from 'socket.io';
import type { ZodType } from 'zod';
import {
  GAME_NAMESPACE,
  PROTOCOL_VERSION,
  type Ack,
  type ErrorCode,
  type TimerSync,
} from '../../shared/protocol';
import type { PublicRoomState } from '../../shared/types';
import type { GameEvent } from '../game/events';
import type { GameState } from '../game/types';
import { AppError, internalApiError, toApiError } from '../http/errors';
import type { PlayerRecord } from '../persistence/repositories';
import type { RoomEmitter, RoomManager } from '../rooms/RoomManager';
import { normalizeRoomCode } from '../rooms/codes';
import { FixedWindowLimiter, TokenBucket } from '../security/rateLimit';
import type { RoomTokenRegistry } from '../security/roomTokens';
import { SessionError, type SessionService } from '../services/session-service';
import type { Logger } from '../util/logger';
import { silentLogger } from '../util/logger';
import {
  answerPayload,
  continuePayload,
  emptyPayload,
  handshakeAuth,
  lobbyReadyPayload,
  manualAnswerPayload,
  roomJoinPayload,
  smallRoomVotePayload,
} from './payloads';

export const SOCKET_EVENT_RATE = 10;
export const SOCKET_EVENT_BURST = 20;
export const CONTROL_CAPABILITIES = [
  'start',
  'pause',
  'resume',
  'skip',
  'manual_answer',
  'close',
] as const;

/** Matchmaking port (phase 7); the gateway only forwards what the queue needs. */
export interface QueueGatewayPort {
  vote(playerId: string, proposalId: string, accept: boolean): void;
  leave(playerId: string): void;
  snapshot?(playerId: string): unknown;
}

export interface GatewayOptions {
  sessions: SessionService;
  manager: RoomManager;
  roomTokens: RoomTokenRegistry;
  logger?: Logger;
  now?: () => number;
  queue?: QueueGatewayPort;
  allowedOrigin?: string | null;
}

type Role = 'player' | 'overlay' | 'control';

interface SocketData {
  role: Role;
  player?: PlayerRecord;
  roomCode?: string;
  bucket: TokenBucket;
}

type EventsMap = Record<string, (...args: any[]) => void>;
type GameSocket = Socket<EventsMap, EventsMap, EventsMap, SocketData>;

function roomChannel(code: string): string {
  return `room:${code}`;
}

function connectError(code: ErrorCode, message: string): Error {
  const error = new Error(message) as Error & { data: { code: ErrorCode; message: string } };
  error.data = { code, message };
  return error;
}

export class Gateway implements RoomEmitter {
  readonly nsp: Namespace;
  private readonly playerSockets = new Map<string, GameSocket>();
  private readonly joinLimiter: FixedWindowLimiter;
  private readonly logger: Logger;
  private readonly now: () => number;

  constructor(
    readonly io: Server,
    private readonly options: GatewayOptions,
  ) {
    this.logger = options.logger ?? silentLogger;
    this.now = options.now ?? Date.now;
    this.joinLimiter = new FixedWindowLimiter(10, 60_000, this.now);
    this.nsp = io.of(GAME_NAMESPACE);
    this.nsp.use((socket, next) => this.authenticate(socket as GameSocket, next));
    this.nsp.on('connection', (socket) => this.onConnection(socket as GameSocket));
  }

  static attach(server: HttpServer, options: GatewayOptions): Gateway {
    const origin = options.allowedOrigin ?? false;
    const io = new Server(server, {
      ...(origin ? { cors: { origin, credentials: false } } : {}),
      serveClient: false,
    });
    return new Gateway(io, options);
  }

  async close(): Promise<void> {
    await this.io.close();
  }

  isConnected(playerId: string): boolean {
    return this.playerSockets.has(playerId);
  }

  connectedCount(): number {
    return this.playerSockets.size;
  }

  // ---- RoomEmitter -------------------------------------------------------

  attach(playerId: string, roomCode: string): void {
    this.playerSockets.get(playerId)?.join(roomChannel(roomCode));
  }

  detach(playerId: string, roomCode: string): void {
    this.playerSockets.get(playerId)?.leave(roomChannel(roomCode));
  }

  roomState(roomCode: string, state: PublicRoomState): void {
    this.nsp.to(roomChannel(roomCode)).emit('ROOM_STATE', state);
  }

  playerLocked(roomCode: string, playerId: string, questionId: string): void {
    this.nsp.to(roomChannel(roomCode)).emit('PLAYER_LOCKED', { questionId, playerId });
  }

  timerSync(roomCode: string, sync: TimerSync): void {
    this.nsp.to(roomChannel(roomCode)).emit('TIMER_SYNC', sync);
  }

  roomClosed(roomCode: string, reason: string): void {
    const channel = roomChannel(roomCode);
    this.nsp.to(channel).emit('ROOM_CLOSED', { reason });
    this.options.roomTokens.revoke(roomCode);
    this.nsp.in(channel).socketsLeave(channel);
  }

  emitToPlayer(playerId: string, event: string, payload: unknown): void {
    this.playerSockets.get(playerId)?.emit(event, payload);
  }

  // ---- connection ----------------------------------------------------------

  private authenticate(socket: GameSocket, next: (error?: Error) => void): void {
    const parsed = handshakeAuth.safeParse(socket.handshake.auth ?? {});
    if (!parsed.success) {
      next(connectError('AUTH_INVALID', 'Invalid handshake.'));
      return;
    }
    const auth = parsed.data;
    const role: Role = auth.role ?? 'player';
    const bucket = new TokenBucket(SOCKET_EVENT_RATE, SOCKET_EVENT_BURST, this.now);

    if (role === 'player') {
      try {
        const { player } = this.options.sessions.authenticate(auth.token ?? null);
        socket.data = { role, player, bucket };
        next();
      } catch (error) {
        if (error instanceof SessionError) {
          next(
            connectError(
              error.code === 'VALIDATION_ERROR' ? 'AUTH_INVALID' : error.code,
              error.message,
            ),
          );
          return;
        }
        next(connectError('INTERNAL_ERROR', 'Authentication failed.'));
      }
      return;
    }

    const code = normalizeRoomCode(auth.roomCode);
    if (!auth.token) {
      next(connectError('AUTH_REQUIRED', 'Authentication is required.'));
      return;
    }
    if (code === null || !this.options.manager.hasRoom(code)) {
      next(connectError('ROOM_NOT_FOUND', 'Room not found.'));
      return;
    }
    if (!this.options.roomTokens.verify(code, role, auth.token)) {
      next(connectError('AUTH_INVALID', 'The token is invalid.'));
      return;
    }
    socket.data = { role, roomCode: code, bucket };
    next();
  }

  private onConnection(socket: GameSocket): void {
    const { role } = socket.data;
    if (role === 'player') {
      this.onPlayerConnection(socket);
    } else {
      this.onRoomRoleConnection(socket);
    }
    this.registerHandlers(socket);
  }

  private onPlayerConnection(socket: GameSocket): void {
    const player = socket.data.player as PlayerRecord;
    const previous = this.playerSockets.get(player.id);
    this.playerSockets.set(player.id, socket);
    if (previous && previous !== socket) {
      previous.emit('SESSION_REPLACED', { reason: 'NEW_CONNECTION' });
      previous.disconnect(true);
    }

    const roomCode = this.options.manager.playerConnected(player.id);
    socket.emit('SESSION_READY', {
      player: { id: player.id, pseudo: player.pseudo, avatar: player.avatar },
      roomCode,
    });
    if (roomCode) {
      this.sendState(socket, roomCode);
    }

    socket.on('disconnect', () => {
      if (this.playerSockets.get(player.id) === socket) {
        this.playerSockets.delete(player.id);
        this.options.queue?.leave(player.id);
        this.options.manager.playerDisconnected(player.id);
      }
    });
  }

  private onRoomRoleConnection(socket: GameSocket): void {
    const code = socket.data.roomCode as string;
    void socket.join(roomChannel(code));
    if (socket.data.role === 'control') {
      socket.emit('CONTROL_READY', { capabilities: [...CONTROL_CAPABILITIES] });
    }
    this.sendState(socket, code);
  }

  private sendState(socket: GameSocket, roomCode: string): void {
    const state = this.options.manager.getPublicState(roomCode);
    if (state) {
      socket.emit('ROOM_STATE', state);
    }
  }

  // ---- handlers --------------------------------------------------------------

  private registerHandlers(socket: GameSocket): void {
    this.on(socket, 'ROOM_JOIN', roomJoinPayload, (payload, ctx) => {
      const player = ctx.requirePlayer();
      const ip = socket.handshake.address;
      if (!this.joinLimiter.hit(ip)) {
        throw new AppError('RATE_LIMITED', 'Too many join attempts.');
      }
      const code = normalizeRoomCode(payload.code);
      if (code === null) {
        throw new AppError('ROOM_NOT_FOUND', 'Room not found.');
      }
      this.options.queue?.leave(player.id);
      this.options.manager.join(code, {
        id: player.id,
        pseudo: player.pseudo,
        avatar: player.avatar,
      });
      this.sendState(socket, code);
      return { roomCode: code };
    });

    this.on(socket, 'ROOM_LEAVE', emptyPayload, (_payload, ctx) => {
      this.options.manager.leave(ctx.requirePlayer().id);
      return { left: true };
    });

    this.on(socket, 'LOBBY_READY', lobbyReadyPayload, (payload, ctx) => {
      const player = ctx.requirePlayer();
      const { code, state } = ctx.requireRoomState(player.id);
      if (state.phase !== 'LOBBY') {
        throw new AppError('INVALID_PHASE', 'The room is not in the lobby.');
      }
      ctx.dispatch(code, { type: 'LOBBY_READY', playerId: player.id, ready: payload.ready });
      return { ready: payload.ready };
    });

    this.on(socket, 'GAME_START', emptyPayload, (_payload, ctx) => {
      const state = ctx.dispatchActor((actor) => ({ type: 'GAME_START', ...actor }));
      return { phase: state.phase };
    });

    this.on(socket, 'ANSWER', answerPayload, (payload, ctx) => {
      const player = ctx.requirePlayer();
      const { code } = ctx.requireRoomState(player.id);
      ctx.dispatch(code, {
        type: 'ANSWER',
        playerId: player.id,
        questionId: payload.questionId,
        choiceIndex: payload.choiceIndex,
      });
      return { lockedIn: true, receivedAt: this.now() };
    });

    this.on(socket, 'CONTINUE', continuePayload, (payload, ctx) => {
      const player = ctx.requirePlayer();
      const { code } = ctx.requireRoomState(player.id);
      const state = ctx.dispatch(code, {
        type: 'CONTINUE',
        playerId: player.id,
        phaseToken: payload.phaseToken,
      });
      const waitingFor = Object.values(state.players)
        .filter(
          (member) => member.status === 'CONNECTED' && !state.continueReady.includes(member.id),
        )
        .map((member) => member.id);
      return { ready: true, waitingFor };
    });

    this.on(socket, 'HOST_PAUSE', emptyPayload, (_payload, ctx) => {
      const state = ctx.dispatchActor((actor) => ({ type: 'HOST_PAUSE', ...actor }));
      return { phase: state.phase };
    });

    this.on(socket, 'HOST_RESUME', emptyPayload, (_payload, ctx) => {
      const state = ctx.dispatchActor((actor) => ({ type: 'HOST_RESUME', ...actor }));
      return { phase: state.phase };
    });

    this.on(socket, 'HOST_SKIP', emptyPayload, (_payload, ctx) => {
      const state = ctx.dispatchActor((actor) => ({ type: 'HOST_SKIP', ...actor }));
      return { phase: state.phase };
    });

    this.on(socket, 'HOST_MANUAL_ANSWER', manualAnswerPayload, (payload, ctx) => {
      if (socket.data.role !== 'control') {
        throw new AppError('NOT_HOST', 'Only the control can answer manually.');
      }
      const code = socket.data.roomCode as string;
      const room = this.options.manager.getState(code);
      if (!room) {
        throw new AppError('ROOM_NOT_FOUND', 'Room not found.');
      }
      if (!room.players[payload.playerId]) {
        throw new AppError('PLAYER_NOT_FOUND', 'Unknown player.');
      }
      const questionId = room.question?.question.id;
      if (room.phase !== 'QUESTION' || !questionId) {
        throw new AppError('INVALID_PHASE', 'No question is open.');
      }
      ctx.dispatch(code, {
        type: 'HOST_MANUAL_ANSWER',
        actorId: null,
        isControl: true,
        playerId: payload.playerId,
        choiceIndex: payload.choiceIndex,
      });
      return { accepted: true };
    });

    this.on(socket, 'HOST_CLOSE', emptyPayload, (_payload, ctx) => {
      ctx.dispatchActor((actor) => ({ type: 'HOST_CLOSE', ...actor }));
      return { closed: true };
    });

    this.on(socket, 'SMALL_ROOM_VOTE', smallRoomVotePayload, (payload, ctx) => {
      const player = ctx.requirePlayer();
      const queue = this.options.queue;
      if (!queue) {
        throw new AppError('PROPOSAL_NOT_FOUND', 'Proposal not found.');
      }
      queue.vote(player.id, payload.proposalId, payload.accept);
      return { recorded: true };
    });
  }

  private on<P, R>(
    socket: GameSocket,
    event: string,
    schema: ZodType<P>,
    handler: (payload: P, ctx: HandlerContext) => R,
  ): void {
    socket.on(event, (rawPayload: unknown, maybeAck?: unknown) => {
      const ack = typeof maybeAck === 'function' ? (maybeAck as (value: Ack<R>) => void) : null;
      const fail = (error: AppError | null): void => {
        const apiError = error ? toApiError(error) : internalApiError();
        if (ack) {
          ack({ ok: false, error: apiError });
        } else {
          socket.emit('ERROR', { error: apiError });
        }
      };

      try {
        if (!socket.data.bucket.take()) {
          throw new AppError('RATE_LIMITED', 'Too many events.');
        }
        const parsed = schema.safeParse(rawPayload);
        if (!parsed.success) {
          throw new AppError('VALIDATION_ERROR', 'Invalid payload.');
        }
        const result = handler(parsed.data, this.contextFor(socket));
        ack?.({ ok: true, data: result });
      } catch (error) {
        if (error instanceof AppError) {
          fail(error);
        } else {
          this.logger.log('error', 'socket.handler_failed', {
            event,
            message: error instanceof Error ? error.message : String(error),
          });
          fail(null);
        }
      }
    });
  }

  private contextFor(socket: GameSocket): HandlerContext {
    const { manager } = this.options;
    const dispatch = (code: string, event: GameEvent) => {
      const result = manager.dispatch(code, event);
      if (!result.ok) {
        throw new AppError(result.code, result.message);
      }
      return result.state;
    };
    return {
      requirePlayer: () => {
        if (socket.data.role !== 'player' || !socket.data.player) {
          throw new AppError('FORBIDDEN', 'This action is reserved to players.');
        }
        return socket.data.player;
      },
      requireRoomState: (playerId) => {
        const code = manager.roomCodeOf(playerId);
        const state = code ? manager.getState(code) : null;
        if (!code || !state) {
          throw new AppError('NOT_IN_ROOM', 'You are not in a room.');
        }
        return { code, state };
      },
      dispatch,
      dispatchActor: (build) => {
        if (socket.data.role === 'overlay') {
          throw new AppError('FORBIDDEN', 'The overlay is read-only.');
        }
        if (socket.data.role === 'control') {
          const code = socket.data.roomCode as string;
          return dispatch(code, build({ actorId: null, isControl: true }));
        }
        const player = socket.data.player as PlayerRecord;
        const code = manager.roomCodeOf(player.id);
        if (!code) {
          throw new AppError('NOT_IN_ROOM', 'You are not in a room.');
        }
        return dispatch(code, build({ actorId: player.id }));
      },
    };
  }
}

interface Actor {
  actorId: string | null;
  isControl?: boolean;
}

interface HandlerContext {
  requirePlayer(): PlayerRecord;
  requireRoomState(playerId: string): { code: string; state: GameState };
  dispatch(code: string, event: GameEvent): GameState;
  dispatchActor(build: (actor: Actor) => GameEvent): GameState;
}

export { PROTOCOL_VERSION };
