import { createServer, type Server as HttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import type { QuestionRecord } from '../shared/schemas';
import { createApp, type AppOptions } from './app';
import { ImageService } from './images/service';
import { QueueManager } from './matchmaking/QueueManager';
import { Gateway } from './realtime/gateway';
import { RoomManager, type RoomEmitter } from './rooms/RoomManager';
import { RoomTokenRegistry } from './security/roomTokens';
import { SessionService } from './services/session-service';
import { createMemoryPersistence } from './persistence/db';
import type { Persistence } from './persistence/repositories';
import { TikTokService } from './tiktok/service';
import type { TikTokAdapterFactory } from './tiktok/adapter';
import { silentLogger, type Logger } from './util/logger';

export interface GameServerOptions extends Omit<
  AppOptions,
  'manager' | 'sessions' | 'presence' | 'queue' | 'tiktok'
> {
  /** Disk cache of proxied images (`IMAGE_CACHE_DIR`); null keeps them in memory only. */
  imageCacheDir?: string | null;
  imageCacheMaxBytes?: number;
  /** Key of the image tokens (D-116), persisted so image links survive a restart. */
  imageTokenSecret?: Buffer;
  questionList: readonly QuestionRecord[];
  logger?: Logger;
  random?: () => number;
  allowedOrigin?: string | null;
  /** Chat connector factory; omit or null to disable TikTok (`TIKTOK_DISABLED`). */
  tiktokAdapterFactory?: TikTokAdapterFactory | null;
  /** Live followed at startup (`TIKTOK_USERNAME`). */
  tiktokDefaultTarget?: string | null;
  /** Simulated chat (`TIKTOK_ADAPTER=fake`). */
  tiktokSimulated?: boolean;
  /** Bring back the rooms saved by the previous process (D-117). */
  restoreRooms?: boolean;
}

export interface GameServer {
  app: Express;
  httpServer: HttpServer;
  gateway: Gateway;
  manager: RoomManager;
  queue: QueueManager;
  persistence: Persistence;
  roomTokens: RoomTokenRegistry;
  tiktok: TikTokService;
  images: ImageService;
  /** `preserveRooms`: keep the running rooms for the next process (graceful restart, D-117). */
  close(options?: { preserveRooms?: boolean }): Promise<void>;
}

/** Wires HTTP, Socket.io, the room manager and persistence together. */
export function createGameServer(options: GameServerOptions): GameServer {
  const persistence = options.persistence ?? createMemoryPersistence(options.questionList);
  const now = options.now ?? Date.now;
  const logger = options.logger ?? silentLogger;
  const sessions = new SessionService({
    persistence,
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  const roomTokens = new RoomTokenRegistry();
  const images =
    options.images ??
    new ImageService({
      now,
      cacheDir: options.imageCacheDir ?? null,
      ...(options.imageTokenSecret ? { tokenSecret: options.imageTokenSecret } : {}),
      rateLimitPerMinute: options.rateLimit === false ? null : 300,
      ...(options.imageCacheMaxBytes === undefined
        ? {}
        : { maxDiskBytes: options.imageCacheMaxBytes }),
    });
  images.registerUrls(options.questionList.map((question) => question.image?.url));

  let gateway: Gateway | null = null;
  const emitter: RoomEmitter = {
    attach: (playerId, code) => gateway?.attach(playerId, code),
    detach: (playerId, code) => gateway?.detach(playerId, code),
    roomState: (code, state) => gateway?.roomState(code, state),
    playerLocked: (code, playerId, questionId) => gateway?.playerLocked(code, playerId, questionId),
    timerSync: (code, sync) => gateway?.timerSync(code, sync),
    roomClosed: (code, reason) => {
      gateway?.roomClosed(code, reason);
      tiktok?.roomClosed(code);
    },
  };
  let tiktok: TikTokService | null = null;

  let queue: QueueManager | null = null;
  const manager = new RoomManager({
    persistence,
    emitter,
    logger,
    now,
    publicView: images.publicView,
    onRequeue: (playerIds, _code, selection) => queue?.requeue(playerIds, selection),
    deps: {
      now,
      random: options.random ?? Math.random,
      idFactory: () => randomUUID(),
      questions: { getQuestions: () => options.questionList },
    },
  });

  const tiktokService = new TikTokService({
    adapterFactory: options.tiktokAdapterFactory ?? null,
    defaultTarget: options.tiktokDefaultTarget ?? null,
    simulated: options.tiktokSimulated ?? false,
    manager,
    persistence,
    roomTokens,
    logger,
  });
  tiktok = tiktokService;

  const presence = { isConnected: (playerId: string) => gateway?.isConnected(playerId) ?? false };
  queue = new QueueManager({
    manager,
    now,
    logger,
    isConnected: presence.isConnected,
    identityOf: (playerId) => {
      const record = persistence.players.findById(playerId);
      return record ? { id: record.id, pseudo: record.pseudo, avatar: record.avatar } : null;
    },
    emitter: {
      queueState: (playerId, state) => gateway?.emitToPlayer(playerId, 'QUEUE_STATE', state),
      matchFound: (playerId, roomCode) =>
        gateway?.emitToPlayer(playerId, 'MATCH_FOUND', { roomCode }),
      smallRoomProposal: (playerId, proposal) =>
        gateway?.emitToPlayer(playerId, 'SMALL_ROOM_PROPOSAL', proposal),
    },
  });
  const matchmaking = queue;
  const app = createApp({
    ...options,
    persistence,
    sessions,
    manager,
    presence,
    queue: matchmaking,
    tiktok: tiktokService,
    images,
  });
  const httpServer = createServer(app);
  gateway = Gateway.attach(httpServer, {
    sessions,
    manager,
    roomTokens,
    logger,
    now,
    queue: matchmaking,
    ...(options.rateLimit === undefined ? {} : { rateLimit: options.rateLimit }),
    ...(options.allowedOrigin === undefined ? {} : { allowedOrigin: options.allowedOrigin }),
  });
  if (options.restoreRooms) {
    const restored = manager.restore();
    if (restored > 0) logger.log('info', 'rooms.restored', { count: restored });
  }
  manager.start();
  matchmaking.start();
  tiktokService.start();

  return {
    app,
    httpServer,
    gateway,
    manager,
    queue: matchmaking,
    persistence,
    roomTokens,
    tiktok: tiktokService,
    images,
    async close(closeOptions = {}) {
      tiktokService.stop();
      matchmaking.stop();
      manager.stop('SERVER_RESTART', { preserve: closeOptions.preserveRooms === true });
      await gateway?.close();
      if (httpServer.listening) {
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      }
    },
  };
}
