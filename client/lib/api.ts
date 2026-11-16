import type { ConfigResponse, ErrorCode } from '../../shared/protocol';
import type { Language } from '../../shared/languages';
import type { Difficulty, GameMode } from '../../shared/types';

export class ApiClientError extends Error {
  constructor(
    readonly code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    readonly status: number,
    readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface SessionResponse {
  playerId: string;
  pseudo: string;
  token: string;
  expiresAt: number;
}

export interface MeResponse {
  playerId: string;
  pseudo: string;
  avatar: string;
  createdAt: number;
}

export interface LeaderboardEntryView {
  rank: number;
  playerId: string;
  pseudo: string;
  avatar: string;
  totalPoints: number;
  matches: number;
  bestMatchPoints: number;
  correctCount: number;
  firstMatchAt: number;
}

export interface Selection {
  mode: GameMode;
  category: string | null;
  difficulty: Difficulty | null;
  /** Language of the questions of the room; French when omitted. */
  language?: Language;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  token?: string | null;
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch {
    throw new ApiClientError('NETWORK_ERROR', 'Network error', 0);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const error = (
      payload as { error?: { code?: ErrorCode; message?: string; requestId?: string } }
    )?.error;
    throw new ApiClientError(
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? 'Request failed',
      response.status,
      error?.requestId ?? null,
    );
  }
  return payload as T;
}

export const api = {
  config: () => request<ConfigResponse>('/api/config'),
  createSession: (pseudo: string) =>
    request<SessionResponse>('/api/sessions', { body: { pseudo } }),
  me: (token: string) => request<MeResponse>('/api/me', { token }),
  updatePseudo: (token: string, pseudo: string) =>
    request<MeResponse>('/api/me', { method: 'PATCH', token, body: { pseudo } }),
  createRoom: (token: string, selection: Selection, maxPlayers?: number) =>
    request<{ roomCode: string }>('/api/rooms', {
      token,
      body: { ...selection, ...(maxPlayers === undefined ? {} : { maxPlayers }) },
    }),
  solo: (token: string, selection: Selection) =>
    request<{ roomCode: string; isSolo: true }>('/api/solo', { token, body: selection }),
  joinQueue: (token: string, selection: Selection) =>
    request<{ queued: boolean; position: number; targetPlayers: number; queuedAt: number }>(
      '/api/queue',
      { token, body: selection },
    ),
  leaveQueue: (token: string) => request<void>('/api/queue', { method: 'DELETE', token }),
  leaderboard: (params: {
    mode?: GameMode | undefined;
    source?: 'web' | 'tiktok' | undefined;
    limit: number;
  }) => {
    const query = new URLSearchParams({ limit: String(params.limit) });
    if (params.mode) query.set('mode', params.mode);
    if (params.source) query.set('source', params.source);
    return request<{ generatedAt: number; entries: LeaderboardEntryView[] }>(
      `/api/leaderboard?${query.toString()}`,
    );
  },
};
