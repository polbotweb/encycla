import { randomUUID } from 'node:crypto';
import type { Persistence } from '../persistence/repositories';
import type { RoomManager } from '../rooms/RoomManager';
import type { IssuedRoomTokens, RoomTokenRegistry } from '../security/roomTokens';
import { avatarFor, normalizePseudo, pseudoNormalized } from '../services/session-service';
import { AppError } from '../http/errors';
import type { ModeSelection } from '../http/modes';
import type { Logger } from '../util/logger';
import type { TikTokAdapterFactory, TikTokChatMessage } from './adapter';
import { TikTokConnector, type ConnectorStatus, type Scheduler } from './connector';
import { publicQuestionId } from '../game/types';
import { parseAnswerComment } from './parser';

export const DEFAULT_TIKTOK_TIMER_MS = 15_000;
const MAX_UNIQUE_ID_LENGTH = 64;
/** An answer is one letter; longer comments are chatter and never parsed. */
export const MAX_COMMENT_LENGTH = 200;
/** Recent message ids remembered to drop a message delivered twice (reconnects). */
const SEEN_MESSAGE_IDS = 2_000;

export interface TikTokPort {
  readonly enabled: boolean;
  /** True with the simulated chat (`TIKTOK_ADAPTER=fake`): `simulateChat` is then available. */
  readonly simulated: boolean;
  isConnected(): boolean;
  /** The live followed (TikTok handle), if any. */
  liveTarget(): string | null;
  /** The open TikTok room, if any (one at a time). */
  activeRoomCode(): string | null;
  createRoom(
    selection: ModeSelection,
    timerMs?: number,
    liveUsername?: string,
  ): { roomCode: string; liveUsername: string; connected: boolean } & IssuedRoomTokens;
  /** Feeds one chat comment as if it came from the live (simulation only). */
  simulateChat(message: TikTokChatMessage): void;
  /** Chat connection details for the streamer console (state, retries, last error). */
  connectionStatus?(): ConnectorStatus | null;
}

export interface TikTokServiceOptions {
  /** `null` disables TikTok entirely (`TIKTOK_DISABLED`). */
  adapterFactory: TikTokAdapterFactory | null;
  manager: RoomManager;
  persistence: Persistence;
  roomTokens: RoomTokenRegistry;
  logger: Logger;
  idFactory?: () => string;
  scheduler?: Scheduler;
  /** Live followed at startup (`TIKTOK_USERNAME`); rooms may name any other live. */
  defaultTarget?: string | null;
  /** Simulated chat (fake adapter): enables `simulateChat` for demos and end-to-end tests. */
  simulated?: boolean;
}

/**
 * Owns the single TikTok chat connector and the (at most one) live TikTok room.
 * Chat comments become answers; the game engine stays the only authority.
 */
export class TikTokService implements TikTokPort {
  private readonly connector: TikTokConnector | null;
  private readonly idFactory: () => string;
  private activeRoom: string | null = null;
  private readonly viewers = new Map<string, string>();
  private capacityLogged = false;
  private readonly seenIds = new Set<string>();

  constructor(private readonly options: TikTokServiceOptions) {
    this.idFactory = options.idFactory ?? randomUUID;
    this.connector = options.adapterFactory
      ? new TikTokConnector({
          factory: options.adapterFactory,
          logger: options.logger,
          onChat: (message) => this.handleChat(message),
          onConnectionChange: (connected) => this.onConnectionChange(connected),
          target: options.defaultTarget ?? null,
          ...(options.scheduler ? { scheduler: options.scheduler } : {}),
        })
      : null;
  }

  get enabled(): boolean {
    return this.connector !== null;
  }

  get simulated(): boolean {
    return this.enabled && this.options.simulated === true;
  }

  liveTarget(): string | null {
    return this.connector?.currentTarget() ?? null;
  }

  simulateChat(message: TikTokChatMessage): void {
    if (!this.simulated) {
      throw new AppError('TIKTOK_DISABLED', 'The simulated TikTok chat is not enabled.');
    }
    this.handleChat(message);
  }

  connectionStatus(): ConnectorStatus | null {
    return this.connector?.status() ?? null;
  }

  isConnected(): boolean {
    return this.connector?.isConnected() ?? false;
  }

  activeRoomCode(): string | null {
    return this.activeRoom !== null && this.options.manager.hasRoom(this.activeRoom)
      ? this.activeRoom
      : null;
  }

  start(): void {
    this.connector?.start();
  }

  stop(): void {
    this.connector?.stop();
  }

  createRoom(
    selection: ModeSelection,
    timerMs: number = DEFAULT_TIKTOK_TIMER_MS,
    liveUsername?: string,
  ): { roomCode: string; liveUsername: string; connected: boolean } & IssuedRoomTokens {
    const connector = this.connector;
    if (!this.enabled || connector === null) {
      throw new AppError('TIKTOK_DISABLED', 'TikTok mode is disabled.');
    }
    if (this.activeRoomCode() !== null) {
      throw new AppError('ROOM_IN_PROGRESS', 'A TikTok room is already open. Close it first.');
    }
    const target = liveUsername ?? connector.currentTarget();
    if (target === null) {
      throw new AppError('VALIDATION_ERROR', 'Name the TikTok live to follow (liveUsername).');
    }
    if (target !== connector.currentTarget()) {
      // Any live: follow the one named by this room; the overlay shows "chat reconnecting" until
      // the connector is in.
      connector.retarget(target);
      connector.start();
    } else if (!this.isConnected()) {
      throw new AppError('TIKTOK_NOT_CONNECTED', 'The TikTok chat connector is offline.');
    }
    const { manager, roomTokens } = this.options;
    const state = manager.createRoom({
      mode: selection.mode,
      category: selection.category,
      difficulty: selection.difficulty,
      language: selection.language,
      host: null,
      isTikTok: true,
      maxPlayers: 100,
      timerMs,
    });
    this.activeRoom = state.roomCode;
    this.viewers.clear();
    this.capacityLogged = false;
    const connected = this.isConnected();
    manager.dispatch(state.roomCode, { type: 'TIKTOK_CONNECTION_CHANGED', connected });
    return {
      roomCode: state.roomCode,
      liveUsername: target,
      connected,
      ...roomTokens.issue(state.roomCode),
    };
  }

  /** Called by the server when any room closes. */
  roomClosed(code: string): void {
    if (code === this.activeRoom) {
      this.activeRoom = null;
      this.viewers.clear();
    }
  }

  private onConnectionChange(connected: boolean): void {
    const code = this.activeRoomCode();
    if (code !== null) {
      this.options.manager.dispatch(code, { type: 'TIKTOK_CONNECTION_CHANGED', connected });
    }
  }

  /** Public for tests; normally fed by the connector. */
  handleChat(message: TikTokChatMessage): void {
    const code = this.activeRoomCode();
    if (code === null) {
      return;
    }
    if (typeof message.comment !== 'string' || message.comment.length > MAX_COMMENT_LENGTH) {
      return;
    }
    if (message.id !== undefined) {
      if (this.seenIds.has(message.id)) return;
      this.seenIds.add(message.id);
      if (this.seenIds.size > SEEN_MESSAGE_IDS) {
        const oldest = this.seenIds.values().next().value;
        if (oldest !== undefined) this.seenIds.delete(oldest);
      }
    }
    const { manager } = this.options;
    const state = manager.getState(code);
    if (!state || state.phase !== 'QUESTION' || !state.question) {
      return;
    }
    const choiceIndex = parseAnswerComment(message.comment);
    if (choiceIndex === null) {
      return;
    }
    const uniqueId =
      typeof message.uniqueId === 'string' ? message.uniqueId.trim().toLowerCase() : '';
    if (uniqueId === '' || uniqueId.length > MAX_UNIQUE_ID_LENGTH) {
      return;
    }

    let playerId = this.viewers.get(uniqueId);
    if (playerId === undefined) {
      if (state.joinedPlayerCount >= state.settings.maxPlayers) {
        if (!this.capacityLogged) {
          this.capacityLogged = true;
          this.options.logger.log('warn', 'tiktok.capacity_reached', { roomCode: code });
        }
        return;
      }
      const record = this.resolveViewer(uniqueId, message.nickname);
      const joined = manager.joinViewer(code, {
        id: record.id,
        pseudo: record.pseudo,
        avatar: record.avatar,
      });
      if (!joined) {
        return;
      }
      playerId = record.id;
      this.viewers.set(uniqueId, playerId);
    }

    // Duplicates, eliminated viewers and late answers are rejected by the engine and ignored.
    manager.dispatch(code, {
      type: 'ANSWER',
      playerId,
      questionId: publicQuestionId(state.question),
      choiceIndex,
    });
  }

  private resolveViewer(uniqueId: string, nickname: string | null) {
    const { persistence } = this.options;
    const existing = persistence.players.findByProviderExternal('tiktok', uniqueId);
    if (existing) {
      return existing;
    }
    const pseudo = viewerPseudo(nickname, uniqueId);
    const now = Date.now();
    const id = this.idFactory();
    return persistence.players.create({
      id,
      provider: 'tiktok',
      externalId: uniqueId,
      pseudo,
      pseudoNormalized: pseudoNormalized(pseudo),
      avatar: avatarFor(id),
      createdAt: now,
      updatedAt: now,
    });
  }
}

/** `nickname` when it survives normalisation, else the handle; never an arbitrary URL or markup. */
export function viewerPseudo(nickname: string | null, uniqueId: string): string {
  for (const candidate of [nickname, uniqueId]) {
    if (!candidate) {
      continue;
    }
    const cleaned = normalizePseudo(candidate)
      .replace(/[^\p{L}\p{M}\p{N} _-]/gu, '')
      .trim();
    const chars = [...cleaned];
    if (chars.length >= 2) {
      return chars.slice(0, 24).join('');
    }
  }
  return 'Viewer';
}
