import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { CATEGORY_VALUES, type QuestionRecord } from '../../shared/schemas';
import { PROTOCOL_VERSION, type ConfigResponse } from '../../shared/protocol';
import { MAX_LIVES } from '../game/scoring';
import type { PlayerRecord, Persistence } from '../persistence/repositories';
import type { RoomManager } from '../rooms/RoomManager';
import { normalizeRoomCode } from '../rooms/codes';
import { FixedWindowLimiter, httpRateLimit } from '../security/rateLimit';
import type { QueueManager } from '../matchmaking/QueueManager';
import { targetFor } from '../matchmaking/QueueManager';
import type { SessionService } from '../services/session-service';
import type { TikTokPort } from '../tiktok/service';
import { adminAuth, getPlayer, playerAuth } from './auth';
import { AppError, sendAppError, sendError } from './errors';
import {
  MIN_QUESTIONS_PER_CATEGORY,
  categoryCounts,
  createRoomSchema,
  languageSchema,
  parseBody,
  resolveSelection,
  tiktokRoomSchema,
} from './modes';

export interface PresencePort {
  isConnected(playerId: string): boolean;
}

export interface GameRouterOptions {
  sessions: SessionService;
  manager: RoomManager;
  persistence: Persistence;
  questions: readonly QuestionRecord[];
  presence: PresencePort;
  queue?: QueueManager | undefined;
  tiktok?: TikTokPort | undefined;
  adminToken: string | null;
  now: () => number;
  rateLimit: boolean;
}

const soloSchema = z
  .object({
    mode: z.enum(['CLASSIC', 'SUBJECT', 'CONTEST']),
    category: z.enum(CATEGORY_VALUES).nullable().optional(),
    difficulty: z.enum(['Novice', 'Adventurer', 'Wizard']).nullable().optional(),
    language: languageSchema.optional(),
  })
  .strict();

const leaderboardQuery = z.object({
  mode: z.enum(['CLASSIC', 'SUBJECT', 'CONTEST']).optional(),
  source: z.enum(['web', 'tiktok']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

type Handler = (request: Request, response: Response) => void;

function guarded(handler: Handler) {
  return (request: Request, response: Response, next: NextFunction): void => {
    try {
      handler(request, response);
    } catch (error) {
      if (error instanceof AppError) {
        sendAppError(response, error);
        return;
      }
      next(error);
    }
  };
}

export function identityOf(player: PlayerRecord): { id: string; pseudo: string; avatar: string } {
  return { id: player.id, pseudo: player.pseudo, avatar: player.avatar };
}

export function buildConfig(questions: readonly QuestionRecord[]): ConfigResponse {
  const counts = categoryCounts(questions);
  return {
    protocolVersion: PROTOCOL_VERSION,
    modes: ['CLASSIC', 'SUBJECT', 'CONTEST'],
    categories: CATEGORY_VALUES.map((value) => {
      const questionCount = counts.get(value) ?? 0;
      return {
        value,
        questionCount,
        subjectEnabled: questionCount >= MIN_QUESTIONS_PER_CATEGORY,
      };
    }),
    constants: {
      maxLives: MAX_LIVES,
      questionsPerLevel: 20,
      totalLevelsClassic: 10,
      contestQuestions: 10,
      maxPlayersWeb: 8,
      maxPlayersTikTok: 100,
    },
  };
}

export function createGameRouter(options: GameRouterOptions): Router {
  const router = Router();
  const { manager, presence, questions } = options;
  const auth = playerAuth(options.sessions);
  const perSession = (limit: number) =>
    options.rateLimit
      ? [
          httpRateLimit(
            new FixedWindowLimiter(limit, 60_000, options.now),
            (_request, response) => getPlayer(response).id,
          ),
        ]
      : [];

  router.get('/config', (_request, response) => {
    response.status(200).json(buildConfig(questions));
  });

  router.get(
    '/leaderboard',
    guarded((request, response) => {
      const parsed = leaderboardQuery.safeParse(request.query);
      if (!parsed.success) {
        throw new AppError('VALIDATION_ERROR', 'The query string is invalid.');
      }
      if (options.persistence.kind !== 'sqlite') {
        throw new AppError('PERSISTENCE_DISABLED', 'Persistence is disabled.');
      }
      const { mode, source, limit, offset } = parsed.data;
      const entries = options.persistence.matches.leaderboard({
        mode: mode ?? null,
        source: source ?? null,
        limit,
        offset,
      });
      response.status(200).json({
        generatedAt: options.now(),
        entries: entries.map((entry, index) => ({ rank: offset + index + 1, ...entry })),
      });
    }),
  );

  router.post(
    '/rooms',
    auth,
    ...perSession(10),
    guarded((request, response) => {
      const player = getPlayer(response);
      const body = parseBody(createRoomSchema, request.body);
      const selection = resolveSelection(body, questions, { allowContest: true });
      const maxPlayers = selection.mode === 'CONTEST' ? 2 : (body.maxPlayers ?? 8);
      if (selection.mode === 'CONTEST' && body.maxPlayers !== undefined && body.maxPlayers !== 2) {
        throw new AppError('VALIDATION_ERROR', 'CONTEST rooms always have exactly two players.');
      }
      const state = manager.createRoom({ ...selection, host: identityOf(player), maxPlayers });
      response.status(201).json({ roomCode: state.roomCode });
    }),
  );

  router.post(
    '/solo',
    auth,
    ...perSession(10),
    guarded((request, response) => {
      const player = getPlayer(response);
      const body = parseBody(soloSchema, request.body);
      const selection = resolveSelection(body, questions, { allowContest: false });
      if (!presence.isConnected(player.id)) {
        throw new AppError('NOT_CONNECTED', 'Open the game socket before starting a solo match.');
      }
      const state = manager.createSolo({ ...selection, host: identityOf(player) });
      response.status(201).json({ roomCode: state.roomCode, isSolo: true });
    }),
  );

  router.post(
    '/queue',
    auth,
    ...perSession(20),
    guarded((request, response) => {
      const player = getPlayer(response);
      const body = parseBody(soloSchema, request.body);
      const selection = resolveSelection(body, questions, { allowContest: true });
      const queue = options.queue;
      if (!queue) {
        throw new AppError('INTERNAL_ERROR', 'Matchmaking is not available.');
      }
      queue.join(identityOf(player), selection);
      const state = queue.snapshot(player.id);
      response.status(202).json({
        queued: true,
        position: state?.position ?? 0,
        targetPlayers: targetFor(selection.mode),
        queuedAt: state?.queuedAt ?? options.now(),
      });
    }),
  );

  router.delete('/queue', auth, (_request, response) => {
    options.queue?.leave(getPlayer(response).id);
    response.status(204).end();
  });

  router.post(
    '/tiktok/rooms',
    adminAuth(options.adminToken),
    guarded((request, response) => {
      const tiktok = options.tiktok;
      if (!tiktok || !tiktok.enabled) {
        throw new AppError('TIKTOK_DISABLED', 'TikTok mode is disabled.');
      }
      const body = parseBody(tiktokRoomSchema, request.body);
      const selection = resolveSelection(body, questions, { allowContest: false });
      const created = tiktok.createRoom(selection, body.timerMs);
      response.status(201).json(created);
    }),
  );

  router.post(
    '/admin/rooms/:code/close',
    adminAuth(options.adminToken),
    guarded((request, response) => {
      const code = normalizeRoomCode(request.params.code);
      if (code === null || !manager.forceClose(code, 'ADMIN_CLOSED')) {
        throw new AppError('ROOM_NOT_FOUND', 'Room not found.');
      }
      response.status(204).end();
    }),
  );

  // Content pipeline routes exist in the contract but are not used at runtime in v1.
  router.use('/admin/questions', adminAuth(options.adminToken), (_request, response) => {
    sendError(response, 501, 'INTERNAL_ERROR', 'The content pipeline is not enabled in v1.');
  });

  return router;
}
