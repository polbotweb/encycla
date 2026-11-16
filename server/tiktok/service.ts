import { randomUUID } from 'node:crypto';
import type { Persistence } from '../persistence/repositories';
import type { RoomManager } from '../rooms/RoomManager';
import type { IssuedRoomTokens, RoomTokenRegistry } from '../security/roomTokens';
import { avatarFor, normalizePseudo, pseudoNormalized } from '../services/session-service';
import { AppError } from '../http/errors';
import type { ModeSelection } from '../http/modes';
import type { Logger } from '../util/logger';
import type { TikTokAdapterFactory, TikTokChatMessage } from './adapter';
import { TikTokConnector, type Scheduler } from './connector';
import { parseAnswerComment } from './parser';

export const DEFAULT_TIKTOK_TIMER_MS = 15_000;
const MAX_UNIQUE_ID_LENGTH = 64;

export interface TikTokPort {
  readonly enabled: boolean;
  isConnected(): boolean;
  createRoom(selection: ModeSelection, timerMs?: number): { roomCode: string } & IssuedRoomTokens;
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

  constructor(private readonly options: TikTokServiceOptions) {
    this.idFactory = options.idFactory ?? randomUUID;
    this.connector = options.adapterFactory
      ? new TikTokConnector({
          factory: options.adapterFactory,
          logger: options.logger,
          onChat: (message) => this.handleChat(message),
          onConnectionChange: (connected) => this.onConnectionChange(connected),
          ...(options.scheduler ? { scheduler: options.scheduler } : {}),
        })
      : null;
  }

  get enabled(): boolean {
    return this.connector !== null;
  }

  isConnected(): boolean {
    return this.connector?.isConnected() ?? false;
  }

  activeRoomCode(): string | null {
    return this.activeRoom !== null && this.options.manager.hasRoom(this.activeRoom) ? this.activeRoom : null;
  }

  start(): void {
    this.connector?.start();
  }

  stop(): void {
    this.connector?.stop();
  }

  createRoom(selection: ModeSelection, timerMs: number = DEFAULT_TIKTOK_TIMER_MS): { roomCode: string } & IssuedRoomTokens {
    if (!this.enabled) {
      throw new AppError('TIKTOK_DISABLED', 'TikTok mode is disabled.');
    }
    if (!this.isConnected()) {
      throw new AppError('TIKTOK_NOT_CONNECTED', 'The TikTok chat connector is offline.');
    }
    if (this.activeRoomCode() !== null) {
      throw new AppError('ROOM_IN_PROGRESS', 'A TikTok room is already open. Close it first.');
    }
    const { manager, roomTokens } = this.options;
    const state = manager.createRoom({
      mode: selection.mode,
      category: selection.category,
      difficulty: selection.difficulty,
      host: null,
      isTikTok: true,
      maxPlayers: 100,
      timerMs,
    });
    this.activeRoom = state.roomCode;
    this.viewers.clear();
    this.capacityLogged = false;
    manager.dispatch(state.roomCode, { type: 'TIKTOK_CONNECTION_CHANGED', connected: true });
    return { roomCode: state.roomCode, ...roomTokens.issue(state.roomCode) };
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
    const { manager } = this.options;
    const state = manager.getState(code);
    if (!state || state.phase !== 'QUESTION' || !state.question) {
      return;
    }
    const choiceIndex = parseAnswerComment(message.comment);
    if (choiceIndex === null) {
      return;
    }
    const uniqueId = typeof message.uniqueId === 'string' ? message.uniqueId.trim().toLowerCase() : '';
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
      questionId: state.question.question.id,
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
    const cleaned = normalizePseudo(candidate).replace(/[^\p{L}\p{M}\p{N} _-]/gu, '').trim();
    const chars = [...cleaned];
    if (chars.length >= 2) {
      return chars.slice(0, 24).join('');
    }
  }
  return 'Viewer';
}
