import { randomUUID } from 'node:crypto';
import type { ErrorCode, TimerSync } from '../../shared/protocol';
import type { Language } from '../../shared/languages';
import type { Difficulty, GameMode, PublicRoomState } from '../../shared/types';
import { createGameState, reduce, tick, toPublicState } from '../game/engine';
import type { GameEvent, PlayerIdentity } from '../game/events';
import type {
  EngineDeps,
  EngineEffect,
  EngineErrorCode,
  GameState,
  ReduceResult,
} from '../game/types';
import { AppError } from '../http/errors';
import type { Persistence } from '../persistence/repositories';
import type { Logger } from '../util/logger';
import { silentLogger } from '../util/logger';
import { generateRoomCode } from './codes';

export const TIMER_SYNC_INTERVAL_MS = 5000;
export const SWEEP_INTERVAL_MS = 1000;
const SYNCED_PHASES = new Set(['COUNTDOWN', 'QUESTION', 'ARTICLE', 'LEVEL_COMPLETE']);

/** Outbound port: the transport layer implements it. The manager never touches sockets. */
export interface RoomEmitter {
  /** Subscribe the player's live socket (if any) to the room channel. */
  attach(playerId: string, roomCode: string): void;
  detach(playerId: string, roomCode: string): void;
  roomState(roomCode: string, state: PublicRoomState): void;
  playerLocked(roomCode: string, playerId: string, questionId: string): void;
  timerSync(roomCode: string, sync: TimerSync): void;
  roomClosed(roomCode: string, reason: string): void;
}

export const nullEmitter: RoomEmitter = {
  attach() {},
  detach() {},
  roomState() {},
  playerLocked() {},
  timerSync() {},
  roomClosed() {},
};

export interface RoomManagerOptions {
  persistence: Persistence;
  deps: Omit<EngineDeps, 'now'> & { now?: () => number };
  emitter?: RoomEmitter;
  logger?: Logger;
  now?: () => number;
  codeFactory?: () => string;
  /** Called when a public room is cancelled and its connected players must go back to the queue. */
  onRequeue?: (
    playerIds: string[],
    roomCode: string,
    selection: { mode: GameMode; category: string | null; difficulty: Difficulty | null },
  ) => void;
}

export interface CreateRoomParams {
  mode: GameMode;
  category: string | null;
  difficulty: Difficulty | null;
  language?: Language;
  host: PlayerIdentity | null;
  isPublic?: boolean;
  isTikTok?: boolean;
  isSolo?: boolean;
  maxPlayers?: number;
  timerMs?: number;
}

interface Room {
  state: GameState;
  timer: ReturnType<typeof setTimeout> | null;
  timerAt: number | null;
  lastSyncAt: number;
}

export type DispatchResult =
  { ok: true; state: GameState } | { ok: false; code: ErrorCode; message: string };

const ENGINE_ERROR_MAP: Record<EngineErrorCode, ErrorCode> = {
  INVALID_PHASE: 'INVALID_PHASE',
  INVALID_EVENT: 'INVALID_PHASE',
  INVALID_OPTION: 'INVALID_OPTION',
  NOT_HOST: 'NOT_HOST',
  NOT_IN_ROOM: 'NOT_IN_ROOM',
  NOT_ENOUGH_PLAYERS: 'NOT_ENOUGH_PLAYERS',
  PLAYERS_NOT_READY: 'PLAYERS_NOT_READY',
  TIKTOK_NOT_CONNECTED: 'TIKTOK_NOT_CONNECTED',
  ANSWER_TOO_LATE: 'ANSWER_TOO_LATE',
  ANSWER_ALREADY_SUBMITTED: 'ANSWER_ALREADY_SUBMITTED',
  QUESTION_MISMATCH: 'QUESTION_MISMATCH',
  STALE_PHASE_TOKEN: 'STALE_PHASE_TOKEN',
  PLAYER_ELIMINATED: 'PLAYER_ELIMINATED',
  PLAYER_FORFEITED: 'PLAYER_FORFEITED',
  PLAYER_NOT_CONNECTED: 'NOT_CONNECTED',
  ROOM_FULL: 'ROOM_FULL',
  ROOM_IN_PROGRESS: 'ROOM_IN_PROGRESS',
  ALREADY_IN_ROOM: 'ALREADY_IN_ROOM',
  NO_QUESTIONS_AVAILABLE: 'INTERNAL_ERROR',
  INVALID_ROOM_SETTINGS: 'VALIDATION_ERROR',
};

const CLOSE_REASON_MAP: Record<string, string> = {
  HOST_CLOSE: 'HOST_CLOSED',
  MATCH_OVER_TTL: 'MATCH_OVER_TIMEOUT',
  MATCH_CANCELLED: 'MATCH_CANCELLED',
  EMPTY_ROOM: 'NO_PLAYERS',
  PLAYER_LEFT: 'NO_PLAYERS',
  INACTIVE: 'NO_PLAYERS',
  PLAYER_DISCONNECTED: 'NO_PLAYERS',
  NO_QUESTIONS_AVAILABLE: 'MATCH_CANCELLED',
  ADMIN_CLOSED: 'ADMIN_CLOSED',
  SERVER_RESTART: 'SERVER_RESTART',
};

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly playerRooms = new Map<string, string>();
  private readonly emitter: RoomEmitter;
  private readonly logger: Logger;
  private readonly now: () => number;
  private readonly engineDeps: EngineDeps;
  private readonly persistence: Persistence;
  private readonly codeFactory: () => string;
  private readonly onRequeue: RoomManagerOptions['onRequeue'];
  private sweeper: ReturnType<typeof setInterval> | null = null;

  constructor(options: RoomManagerOptions) {
    this.persistence = options.persistence;
    this.emitter = options.emitter ?? nullEmitter;
    this.logger = options.logger ?? silentLogger;
    this.now = options.now ?? options.deps.now ?? Date.now;
    this.engineDeps = { ...options.deps, now: this.now };
    this.codeFactory = options.codeFactory ?? (() => generateRoomCode());
    this.onRequeue = options.onRequeue;
  }

  // ---- lifecycle -------------------------------------------------------

  start(): void {
    if (this.sweeper === null) {
      this.sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
      this.sweeper.unref();
    }
  }

  stop(reason = 'SERVER_RESTART'): void {
    if (this.sweeper !== null) {
      clearInterval(this.sweeper);
      this.sweeper = null;
    }
    for (const code of [...this.rooms.keys()]) {
      this.forceClose(code, reason);
    }
  }

  // ---- queries -----------------------------------------------------------

  roomCount(): number {
    return this.rooms.size;
  }

  hasRoom(code: string): boolean {
    return this.rooms.has(code);
  }

  getState(code: string): GameState | null {
    return this.rooms.get(code)?.state ?? null;
  }

  getPublicState(code: string): PublicRoomState | null {
    const room = this.rooms.get(code);
    return room ? toPublicState(room.state, this.now()) : null;
  }

  roomCodeOf(playerId: string): string | null {
    return this.playerRooms.get(playerId) ?? null;
  }

  isInRoom(playerId: string): boolean {
    this.releaseTerminalMembership(playerId);
    return this.playerRooms.has(playerId);
  }

  // ---- creation ----------------------------------------------------------

  createRoom(params: CreateRoomParams): GameState {
    if (params.host) {
      this.assertNotInRoom(params.host.id);
    }
    const code = this.uniqueCode();
    const state = createGameState({
      roomCode: code,
      mode: params.mode,
      difficulty: params.difficulty,
      category: params.category,
      ...(params.language === undefined ? {} : { language: params.language }),
      isPublic: params.isPublic ?? false,
      isTikTok: params.isTikTok ?? false,
      isSolo: params.isSolo ?? false,
      host: params.host,
      ...(params.maxPlayers === undefined ? {} : { maxPlayers: params.maxPlayers }),
      ...(params.timerMs === undefined ? {} : { timerMs: params.timerMs }),
      now: this.now(),
    });
    this.rooms.set(code, { state, timer: null, timerAt: null, lastSyncAt: 0 });
    if (params.host && !state.isTikTok) {
      this.playerRooms.set(params.host.id, code);
      this.emitter.attach(params.host.id, code);
    }
    this.logger.log('info', 'room.created', {
      roomCode: code,
      mode: params.mode,
      isPublic: state.isPublic,
      isSolo: state.isSolo,
      isTikTok: state.isTikTok,
    });
    return state;
  }

  /** Solo: one-player room started immediately (COUNTDOWN). */
  createSolo(
    params: Omit<CreateRoomParams, 'isSolo' | 'isPublic' | 'isTikTok' | 'host'> & {
      host: PlayerIdentity;
    },
  ): GameState {
    const created = this.createRoom({ ...params, isSolo: true, maxPlayers: 1 });
    const started = this.dispatch(created.roomCode, {
      type: 'GAME_START',
      actorId: params.host.id,
    });
    if (!started.ok) {
      this.forceClose(created.roomCode, 'MATCH_CANCELLED');
      throw new AppError(started.code, started.message);
    }
    return started.state;
  }

  /** Public room built by matchmaking: all players are joined, then the match starts at once. */
  createPublicRoom(
    params: {
      mode: GameMode;
      category: string | null;
      difficulty: Difficulty | null;
      language?: Language;
    },
    players: PlayerIdentity[],
  ): GameState {
    for (const player of players) {
      this.assertNotInRoom(player.id);
    }
    const [first, ...rest] = players;
    if (!first) {
      throw new AppError('VALIDATION_ERROR', 'A public room needs players.');
    }
    const created = this.createRoom({
      ...params,
      host: first,
      isPublic: true,
      maxPlayers: params.mode === 'CONTEST' ? 2 : 8,
    });
    for (const player of rest) {
      this.joinInternal(created.roomCode, player);
    }
    const started = this.dispatch(created.roomCode, {
      type: 'GAME_START',
      actorId: null,
      system: true,
    });
    if (!started.ok) {
      this.forceClose(created.roomCode, 'MATCH_CANCELLED');
      throw new AppError(started.code, started.message);
    }
    return started.state;
  }

  // ---- membership ----------------------------------------------------------

  /** `ROOM_JOIN`: only private web rooms are joinable by code (D-72). */
  join(code: string, player: PlayerIdentity): GameState {
    const room = this.rooms.get(code);
    if (!room || room.state.isPublic || room.state.isTikTok || room.state.isSolo) {
      throw new AppError('ROOM_NOT_FOUND', 'Room not found.');
    }
    if (room.state.players[player.id]) {
      // Idempotent: the creator (already seated) or a reconnecting member.
      this.playerRooms.set(player.id, code);
      this.emitter.attach(player.id, code);
      this.broadcast(room);
      return room.state;
    }
    this.assertNotInRoom(player.id);
    if (room.state.phase === 'CLOSED') {
      throw new AppError('ROOM_CLOSED', 'The room is closed.');
    }
    if (room.state.phase !== 'LOBBY') {
      throw new AppError('ROOM_IN_PROGRESS', 'The match has already started.');
    }
    if (room.state.joinedPlayerCount >= room.state.settings.maxPlayers) {
      throw new AppError('ROOM_FULL', 'The room is full.');
    }
    return this.joinInternal(code, player);
  }

  /**
   * TikTok viewers have no socket and no session: they are seated in the room only (never in
   * `playerRooms`) and answer through the chat connector. Returns null when the room is full
   * or closed.
   */
  joinViewer(code: string, viewer: PlayerIdentity): GameState | null {
    const room = this.rooms.get(code);
    if (!room || !room.state.isTikTok) {
      return null;
    }
    const result = this.dispatch(code, {
      type: 'PLAYER_JOIN',
      player: { ...viewer, displayName: this.displayNameFor(room.state, viewer) },
    });
    return result.ok && result.state.players[viewer.id] ? result.state : null;
  }

  private joinInternal(code: string, player: PlayerIdentity): GameState {
    const room = this.rooms.get(code);
    if (!room) {
      throw new AppError('ROOM_NOT_FOUND', 'Room not found.');
    }
    const result = this.dispatch(code, {
      type: 'PLAYER_JOIN',
      player: { ...player, displayName: this.displayNameFor(room.state, player) },
    });
    if (!result.ok) {
      throw new AppError(result.code, result.message);
    }
    if (!result.state.players[player.id]) {
      throw new AppError('ROOM_FULL', 'The room is full.');
    }
    this.playerRooms.set(player.id, code);
    this.emitter.attach(player.id, code);
    return result.state;
  }

  /** `ROOM_LEAVE`. After a finished match this only releases the player. */
  leave(playerId: string): void {
    const code = this.playerRooms.get(playerId);
    if (!code) {
      throw new AppError('NOT_IN_ROOM', 'You are not in a room.');
    }
    const room = this.rooms.get(code);
    if (!room) {
      this.playerRooms.delete(playerId);
      return;
    }
    if (room.state.phase === 'MATCH_OVER') {
      this.release(playerId, code);
      if (![...this.playerRooms.values()].includes(code)) {
        this.forceClose(code, 'NO_PLAYERS');
      }
      return;
    }
    const result = this.dispatch(code, { type: 'PLAYER_LEAVE', playerId });
    if (!result.ok) {
      throw new AppError(result.code, result.message);
    }
    this.release(playerId, code);
  }

  /** Socket connected (or re-connected) for a player. */
  playerConnected(playerId: string): string | null {
    const code = this.playerRooms.get(playerId);
    if (!code) {
      return null;
    }
    const room = this.rooms.get(code);
    if (!room) {
      this.playerRooms.delete(playerId);
      return null;
    }
    this.emitter.attach(playerId, code);
    const member = room.state.players[playerId];
    if (member?.status === 'DISCONNECTED') {
      this.dispatch(code, { type: 'PLAYER_RECONNECT', playerId });
    }
    return code;
  }

  playerDisconnected(playerId: string): void {
    const code = this.playerRooms.get(playerId);
    if (!code) {
      return;
    }
    const room = this.rooms.get(code);
    if (!room) {
      return;
    }
    if (room.state.players[playerId]?.status === 'CONNECTED') {
      this.dispatch(code, { type: 'PLAYER_DISCONNECT', playerId });
    }
  }

  // ---- events ----------------------------------------------------------------

  dispatch(code: string, event: GameEvent): DispatchResult {
    const room = this.rooms.get(code);
    if (!room) {
      return { ok: false, code: 'ROOM_NOT_FOUND', message: 'Room not found.' };
    }
    const result = reduce(room.state, event, this.engineDeps);
    return this.commit(room, result);
  }

  /** Advance every room clock. Called by timers and the sweeper; tests call it directly. */
  tickRoom(code: string): void {
    const room = this.rooms.get(code);
    if (!room) {
      return;
    }
    const now = this.now();
    const result = tick(room.state, now, this.engineDeps);
    this.commit(room, result);
    const live = this.rooms.get(code);
    if (live) {
      this.maybeSyncTimer(live, now);
    }
  }

  sweep(): void {
    for (const code of [...this.rooms.keys()]) {
      this.tickRoom(code);
    }
  }

  /** Admin / shutdown close: abandons the running match, never throws. */
  forceClose(code: string, reason: string): boolean {
    const room = this.rooms.get(code);
    if (!room) {
      return false;
    }
    const state = room.state;
    if (state.matchId !== null && state.matchStatus === 'in_progress') {
      this.safely(() => this.persistence.matches.abandon(state.matchId as string, this.now()));
    }
    this.removeRoom(code, room, reason);
    return true;
  }

  // ---- internals ---------------------------------------------------------------

  private commit(room: Room, result: ReduceResult): DispatchResult {
    if (result.error) {
      return {
        ok: false,
        code: ENGINE_ERROR_MAP[result.error.code],
        message: result.error.message,
      };
    }
    const previous = room.state;
    const next = result.state;
    room.state = next;

    let broadcast = false;
    let closedReason: string | null = null;
    for (const effect of result.effects) {
      const outcome = this.applyEffect(room, effect);
      broadcast = broadcast || outcome.broadcast;
      closedReason = outcome.closedReason ?? closedReason;
    }

    this.reconcileMembers(previous, next, room.state.roomCode);
    this.rearm(room);

    if (broadcast) {
      this.broadcast(room);
    }
    if (previous.phase === 'PAUSED' && next.phase !== 'PAUSED' && next.phase !== 'CLOSED') {
      this.syncTimer(room, this.now());
    }
    if (closedReason !== null || next.phase === 'CLOSED') {
      this.removeRoom(
        room.state.roomCode,
        room,
        closedReason ?? next.closedReason ?? 'NO_PLAYERS',
        true,
      );
    }
    return { ok: true, state: next };
  }

  private applyEffect(
    room: Room,
    effect: EngineEffect,
  ): { broadcast: boolean; closedReason: string | null } {
    const outcome = { broadcast: false, closedReason: null as string | null };
    switch (effect.type) {
      case 'BROADCAST_STATE':
        outcome.broadcast = true;
        break;
      case 'EMIT_PLAYER_LOCKED':
        this.emitter.playerLocked(effect.roomCode, effect.playerId, effect.questionId);
        break;
      case 'SCHEDULE_PHASE':
      case 'CANCEL_SCHEDULE':
        // Timers are re-armed from `state.phaseEndsAt` after every commit.
        break;
      case 'PERSIST_MATCH_STARTED':
        this.safely(() => {
          this.persistence.matches.create(effect.match, effect.players, effect.match.startedAt);
          this.persistence.matches.start(effect.match.id, effect.match.startedAt);
        });
        break;
      case 'PERSIST_SCORES':
        this.safely(() => {
          const matchId = room.state.matchId;
          if (matchId !== null) {
            this.persistence.matches.updateScores(matchId, effect.scores, this.now());
          }
        });
        break;
      case 'PERSIST_MATCH_COMPLETED':
        this.safely(() =>
          this.persistence.matches.complete(effect.matchId, effect.results, this.now()),
        );
        break;
      case 'PERSIST_MATCH_ABANDONED':
        this.safely(() => this.persistence.matches.abandon(effect.matchId, this.now()));
        break;
      case 'EMIT_ROOM_CLOSED':
        outcome.closedReason = CLOSE_REASON_MAP[effect.reason] ?? 'NO_PLAYERS';
        break;
      case 'REQUEUE_PUBLIC_PLAYERS':
        if (this.onRequeue && effect.playerIds.length > 0) {
          const ids = effect.playerIds;
          const code = effect.roomCode;
          const { mode, category, difficulty } = room.state;
          queueMicrotask(() => this.onRequeue?.(ids, code, { mode, category, difficulty }));
        }
        break;
      case 'LOG':
        this.logger.log(effect.level, effect.event, effect.data);
        break;
    }
    return outcome;
  }

  /** Persistence failures must never take a live room down (D-77). */
  private safely(action: () => void): void {
    try {
      action();
    } catch (error) {
      this.logger.log('error', 'persistence.failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private broadcast(room: Room): void {
    this.emitter.roomState(room.state.roomCode, toPublicState(room.state, this.now()));
  }

  private rearm(room: Room): void {
    const at = room.state.phase === 'PAUSED' ? null : room.state.phaseEndsAt;
    if (room.timerAt === at) {
      return;
    }
    if (room.timer !== null) {
      clearTimeout(room.timer);
      room.timer = null;
    }
    room.timerAt = at;
    if (at === null) {
      return;
    }
    const code = room.state.roomCode;
    const delay = Math.max(0, at - this.now());
    room.timer = setTimeout(() => {
      room.timer = null;
      room.timerAt = null;
      this.tickRoom(code);
    }, delay);
    room.timer.unref();
  }

  private maybeSyncTimer(room: Room, now: number): void {
    if (SYNCED_PHASES.has(room.state.phase) && now - room.lastSyncAt >= TIMER_SYNC_INTERVAL_MS) {
      this.syncTimer(room, now);
    }
  }

  private syncTimer(room: Room, now: number): void {
    room.lastSyncAt = now;
    const { state } = room;
    this.emitter.timerSync(state.roomCode, {
      phase: state.phase,
      phaseEndsAt: state.phaseEndsAt,
      serverNow: now,
      paused: state.phase === 'PAUSED',
      remainingMs: state.phase === 'PAUSED' ? state.remainingMsWhenPaused : null,
    });
  }

  private reconcileMembers(previous: GameState, next: GameState, code: string): void {
    for (const id of Object.keys(previous.players)) {
      if (!next.players[id] && this.playerRooms.get(id) === code) {
        this.release(id, code);
      }
    }
  }

  private release(playerId: string, code: string): void {
    if (this.playerRooms.get(playerId) === code) {
      this.playerRooms.delete(playerId);
    }
    this.emitter.detach(playerId, code);
  }

  private removeRoom(code: string, room: Room, reason: string, alreadyClosed = false): void {
    if (room.timer !== null) {
      clearTimeout(room.timer);
      room.timer = null;
    }
    this.rooms.delete(code);
    this.emitter.roomClosed(code, reason);
    for (const [playerId, playerCode] of [...this.playerRooms.entries()]) {
      if (playerCode === code) {
        this.release(playerId, code);
      }
    }
    this.logger.log('info', 'room.closed', { roomCode: code, reason, alreadyClosed });
  }

  private assertNotInRoom(playerId: string): void {
    this.releaseTerminalMembership(playerId);
    if (this.playerRooms.has(playerId)) {
      throw new AppError('ALREADY_IN_ROOM', 'You are already in a room.');
    }
  }

  /** A player stuck in a finished room may start something new. */
  private releaseTerminalMembership(playerId: string): void {
    const code = this.playerRooms.get(playerId);
    if (!code) {
      return;
    }
    const room = this.rooms.get(code);
    if (!room) {
      this.playerRooms.delete(playerId);
      return;
    }
    if (room.state.phase === 'MATCH_OVER') {
      this.release(playerId, code);
    }
  }

  private displayNameFor(state: GameState, player: PlayerIdentity): string {
    const taken = new Set(
      Object.values(state.players).map((member) => member.displayName.toLowerCase()),
    );
    if (!taken.has(player.pseudo.toLowerCase())) {
      return player.pseudo;
    }
    for (let suffix = 2; suffix < 1000; suffix += 1) {
      const candidate = `${player.pseudo} (${suffix})`;
      if (!taken.has(candidate.toLowerCase())) {
        return candidate;
      }
    }
    return player.pseudo;
  }

  private uniqueCode(): string {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const code = this.codeFactory();
      if (!this.rooms.has(code)) {
        return code;
      }
    }
    throw new AppError('INTERNAL_ERROR', 'Could not allocate a room code.');
  }

  /** Stable unique id factory exposed for engine deps. */
  static idFactory(): string {
    return randomUUID();
  }
}
