import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express, { type ErrorRequestHandler, type Express } from 'express';
import helmet from 'helmet';
import type { QuestionRecord } from '../shared/schemas';
import { VERSION } from './config';
import { createGameRouter, type PresencePort } from './http/game';
import { buildHealth, type QuestionsHealth } from './http/health';
import { sendError } from './http/errors';
import { createSessionsRouter } from './http/sessions';
import { createMemoryPersistence } from './persistence/db';
import type { Persistence } from './persistence/repositories';
import type { QueueManager } from './matchmaking/QueueManager';
import { RoomManager } from './rooms/RoomManager';
import { FixedWindowLimiter, httpRateLimit } from './security/rateLimit';
import { SessionService } from './services/session-service';

export interface AppOptions {
  persistence?: Persistence;
  questions?: QuestionsHealth;
  questionsUsable?: boolean;
  /** Approved question bank used by the game (defaults to the persistence copy). */
  questionList?: readonly QuestionRecord[];
  manager?: RoomManager;
  sessions?: SessionService;
  presence?: PresencePort;
  queue?: QueueManager;
  adminToken?: string | null;
  now?: () => number;
  startedAt?: number;
  /** Directory of the built Vite client served in production. */
  staticDir?: string | null;
  rateLimit?: boolean;
  trustProxy?: boolean | number | string;
}

const NOT_CONNECTED: PresencePort = { isConnected: () => false };

export function createApp(options: AppOptions = {}): Express {
  const app = express();
  const persistence = options.persistence ?? createMemoryPersistence();
  const now = options.now ?? Date.now;
  const startedAt = options.startedAt ?? now();
  const questions = options.questions ?? 'degraded';
  const questionsUsable = options.questionsUsable ?? true;
  const questionList = options.questionList ?? persistence.questions.listApproved();
  const sessions =
    options.sessions ??
    new SessionService({
      persistence,
      ...(options.now === undefined ? {} : { now: options.now }),
    });
  const manager =
    options.manager ??
    new RoomManager({
      persistence,
      deps: {
        now,
        random: Math.random,
        idFactory: () => crypto.randomUUID(),
        questions: { getQuestions: () => questionList },
      },
    });
  const rateLimit = options.rateLimit ?? true;

  app.disable('x-powered-by');
  if (options.trustProxy !== undefined) {
    app.set('trust proxy', options.trustProxy);
  }
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'"],
          'font-src': ["'self'"],
          'img-src': ["'self'", 'https://upload.wikimedia.org', 'https://commons.wikimedia.org'],
          'connect-src': ["'self'"],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
          'frame-ancestors': ["'none'"],
          'form-action': ["'self'"],
        },
      },
    }),
  );
  app.use(express.json({ limit: '16kb' }));

  if (rateLimit) {
    app.use('/api', httpRateLimit(new FixedWindowLimiter(100, 60_000, now)));
    app.post('/api/sessions', httpRateLimit(new FixedWindowLimiter(10, 60_000, now)));
  }

  app.use('/api', createSessionsRouter(sessions));
  app.use(
    '/api',
    createGameRouter({
      sessions,
      manager,
      persistence,
      questions: questionList,
      presence: options.presence ?? NOT_CONNECTED,
      queue: options.queue,
      adminToken: options.adminToken ?? null,
      now,
      rateLimit,
    }),
  );

  app.get('/api/health', (_request, response) => {
    const health = buildHealth({
      persistence,
      questions,
      questionsUsable,
      uptimeMs: now() - startedAt,
      version: VERSION,
    });
    response.status(health.statusCode).json(health.body);
  });

  app.use('/api', (_request, response) => {
    sendError(response, 404, 'ROOM_NOT_FOUND', 'Unknown API route.');
  });

  const staticDir = options.staticDir ? resolve(options.staticDir) : null;
  if (staticDir && existsSync(staticDir)) {
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/|socket\.io\/).*/, (_request, response) => {
      response.sendFile(resolve(staticDir, 'index.html'));
    });
  }

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof SyntaxError) {
      sendError(response, 400, 'VALIDATION_ERROR', 'The request body is not valid JSON.');
      return;
    }
    if ((error as { type?: string }).type === 'entity.too.large') {
      sendError(response, 413, 'VALIDATION_ERROR', 'The request body is too large.');
      return;
    }
    sendError(response, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
  };
  app.use(errorHandler);

  return app;
}
