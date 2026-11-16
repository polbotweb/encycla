import type { Difficulty, GameMode, PublicRoomState } from './types';

export const PROTOCOL_VERSION = 1;
export const GAME_NAMESPACE = '/game';

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'AUTH_REQUIRED',
  'AUTH_INVALID',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'ROOM_IN_PROGRESS',
  'ROOM_CLOSED',
  'ALREADY_IN_ROOM',
  'NOT_IN_ROOM',
  'NOT_CONNECTED',
  'NOT_HOST',
  'NOT_ENOUGH_PLAYERS',
  'PLAYERS_NOT_READY',
  'INVALID_PHASE',
  'STALE_PHASE_TOKEN',
  'INVALID_OPTION',
  'QUESTION_MISMATCH',
  'ANSWER_TOO_LATE',
  'ANSWER_ALREADY_SUBMITTED',
  'PLAYER_ELIMINATED',
  'PLAYER_FORFEITED',
  'PLAYER_NOT_FOUND',
  'QUEUE_ALREADY_JOINED',
  'QUEUE_NOT_JOINED',
  'PROPOSAL_NOT_FOUND',
  'PROPOSAL_EXPIRED',
  'CATEGORY_INSUFFICIENT_QUESTIONS',
  'TIKTOK_DISABLED',
  'TIKTOK_NOT_CONNECTED',
  'PERSISTENCE_DISABLED',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'PROTOCOL_VERSION_MISMATCH',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  requestId: string;
}

export type Ack<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export const HTTP_STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  AUTH_REQUIRED: 401,
  AUTH_INVALID: 401,
  SESSION_EXPIRED: 401,
  FORBIDDEN: 403,
  ROOM_NOT_FOUND: 404,
  ROOM_FULL: 409,
  ROOM_IN_PROGRESS: 409,
  ROOM_CLOSED: 409,
  ALREADY_IN_ROOM: 409,
  NOT_IN_ROOM: 409,
  NOT_CONNECTED: 409,
  NOT_HOST: 403,
  NOT_ENOUGH_PLAYERS: 409,
  PLAYERS_NOT_READY: 409,
  INVALID_PHASE: 409,
  STALE_PHASE_TOKEN: 409,
  INVALID_OPTION: 400,
  QUESTION_MISMATCH: 409,
  ANSWER_TOO_LATE: 409,
  ANSWER_ALREADY_SUBMITTED: 409,
  PLAYER_ELIMINATED: 409,
  PLAYER_FORFEITED: 409,
  PLAYER_NOT_FOUND: 404,
  QUEUE_ALREADY_JOINED: 409,
  QUEUE_NOT_JOINED: 409,
  PROPOSAL_NOT_FOUND: 404,
  PROPOSAL_EXPIRED: 409,
  CATEGORY_INSUFFICIENT_QUESTIONS: 409,
  TIKTOK_DISABLED: 503,
  TIKTOK_NOT_CONNECTED: 503,
  PERSISTENCE_DISABLED: 503,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  PROTOCOL_VERSION_MISMATCH: 409,
};

export interface ConfigResponse {
  protocolVersion: number;
  modes: GameMode[];
  categories: { value: string; questionCount: number; subjectEnabled: boolean }[];
  constants: {
    maxLives: number;
    questionsPerLevel: number;
    totalLevelsClassic: number;
    contestQuestions: number;
    maxPlayersWeb: number;
    maxPlayersTikTok: number;
  };
}

export interface CreateRoomRequest {
  mode: GameMode;
  category: string | null;
  difficulty: Difficulty | null;
  maxPlayers?: number;
}

export interface TimerSync {
  phase: PublicRoomState['phase'];
  phaseEndsAt: number | null;
  serverNow: number;
  paused: boolean;
  remainingMs: number | null;
}

/** Client → server socket events. */
export const CLIENT_EVENTS = [
  'ROOM_JOIN',
  'ROOM_LEAVE',
  'LOBBY_READY',
  'GAME_START',
  'ANSWER',
  'CONTINUE',
  'HOST_PAUSE',
  'HOST_RESUME',
  'HOST_SKIP',
  'HOST_MANUAL_ANSWER',
  'HOST_CLOSE',
  'SMALL_ROOM_VOTE',
] as const;

export type ClientEvent = (typeof CLIENT_EVENTS)[number];
