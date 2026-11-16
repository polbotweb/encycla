import { createServer, type Server as HttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import type { QuestionRecord } from '../shared/schemas';
import { createApp, type AppOptions } from './app';
import { QueueManager } from './matchmaking/QueueManager';
import { Gateway } from './realtime/gateway';
import { RoomManager, type RoomEmitter } from './rooms/RoomManager';
import { RoomTokenRegistry } from './security/roomTokens';
import { SessionService } from './services/session-service';
import { createMemoryPersistence } from './persistence/db';
import type { Persistence } from './persistence/repositories';
import { silentLogger, type Logger } from './util/logger';

export interface GameServerOptions extends Omit<AppOptions, 'manager' | 'sessions' | 'presence' | 'queue'> {
  questionList: readonly QuestionRecord[];
  logger?: Logger;
  random?: () => number;
  allowedOrigin?: string | null;
}

export interface GameServer {
  app: Express;
  httpServer: HttpServer;
  gateway: Gateway;
  manager: RoomManager;
  queue: QueueManager;
  persistence: Persistence;
  roomTokens: RoomTokenRegistry;
  close(): Promise<void>;
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

  let gateway: Gateway | null = null;
  const emitter: RoomEmitter = {
    attach: (playerId, code) => gateway?.attach(playerId, code),
    detach: (playerId, code) => gateway?.detach(playerId, code),
    roomState: (code, state) => gateway?.roomState(code, state),
    playerLocked: (code, playerId, questionId) => gateway?.playerLocked(code, playerId, questionId),
    timerSync: (code, sync) => gateway?.timerSync(code, sync),
    roomClosed: (code, reason) => gateway?.roomClosed(code, reason),
  };

  let queue: QueueManager | null = null;
  const manager = new RoomManager({
    persistence,
    emitter,
    logger,
    now,
    onRequeue: (playerIds, _code, selection) => queue?.requeue(playerIds, selection),
    deps: {
      now,
      random: options.random ?? Math.random,
      idFactory: () => randomUUID(),
      questions: { getQuestions: () => options.questionList },
    },
  });

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
      matchFound: (playerId, roomCode) => gateway?.emitToPlayer(playerId, 'MATCH_FOUND', { roomCode }),
      smallRoomProposal: (playerId, proposal) =>
        gateway?.emitToPlayer(playerId, 'SMALL_ROOM_PROPOSAL', proposal),
    },
  });
  const matchmaking = queue;
  const app = createApp({ ...options, persistence, sessions, manager, presence, queue: matchmaking });
  const httpServer = createServer(app);
  gateway = Gateway.attach(httpServer, {
    sessions,
    manager,
    roomTokens,
    logger,
    now,
    queue: matchmaking,
    ...(options.allowedOrigin === undefined ? {} : { allowedOrigin: options.allowedOrigin }),
  });
  manager.start();
  matchmaking.start();

  return {
    app,
    httpServer,
    gateway,
    manager,
    queue: matchmaking,
    persistence,
    roomTokens,
    async close() {
      matchmaking.stop();
      manager.stop();
      await gateway?.close();
      if (httpServer.listening) {
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      }
    },
  };
}
