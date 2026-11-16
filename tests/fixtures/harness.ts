import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import type { Ack } from '../../shared/protocol';
import type { PublicRoomState } from '../../shared/types';
import { initializePersistence } from '../../server/persistence/db';
import { createGameServer, type GameServer, type GameServerOptions } from '../../server/server';
import { TEST_QUESTIONS } from './questions';

export interface Clock {
  now: () => number;
  advance: (ms: number) => void;
}

export function makeClock(start = 1_800_000_000_000): Clock {
  let current = start;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
  };
}

export interface Harness {
  server: GameServer;
  clock: Clock;
  baseUrl: string;
  close(): Promise<void>;
  newPlayer(pseudo: string): Promise<TestPlayer>;
  api(path: string, init?: { method?: string; token?: string; body?: unknown }): Promise<{
    status: number;
    body: any;
  }>;
}

export interface TestPlayer {
  playerId: string;
  pseudo: string;
  token: string;
  socket: Socket;
  states: PublicRoomState[];
  events: { name: string; payload: unknown }[];
  last(): PublicRoomState | undefined;
  emit<T = unknown>(event: string, payload?: unknown): Promise<Ack<T>>;
  waitFor(predicate: (state: PublicRoomState) => boolean, timeoutMs?: number): Promise<PublicRoomState>;
  disconnect(): void;
}

export async function startHarness(
  options: Partial<GameServerOptions> = {},
): Promise<Harness> {
  const clock = makeClock();
  const initialized = initializePersistence({
    databasePath: ':memory:',
    questions: TEST_QUESTIONS,
    now: clock.now(),
  });
  const server = createGameServer({
    questionList: TEST_QUESTIONS,
    persistence: initialized.persistence,
    now: clock.now,
    rateLimit: false,
    adminToken: 'admin-secret-for-tests',
    ...options,
  });
  await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = server.httpServer.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  const players: TestPlayer[] = [];

  async function api(
    path: string,
    init: { method?: string; token?: string; body?: unknown } = {},
  ): Promise<{ status: number; body: any }> {
    const response = await fetch(`${baseUrl}${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: {
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  async function newPlayer(pseudo: string): Promise<TestPlayer> {
    const session = await api('/api/sessions', { body: { pseudo } });
    const socket = connect(`${baseUrl}/game`, {
      auth: { role: 'player', token: session.body.token },
      transports: ['websocket'],
      reconnection: false,
    });
    const states: PublicRoomState[] = [];
    const events: { name: string; payload: unknown }[] = [];
    socket.onAny((name, payload) => events.push({ name, payload }));
    socket.on('ROOM_STATE', (state: PublicRoomState) => states.push(state));
    await new Promise<void>((resolve, reject) => {
      socket.once('SESSION_READY', () => resolve());
      socket.once('connect_error', reject);
    });
    const player: TestPlayer = {
      playerId: session.body.playerId,
      pseudo,
      token: session.body.token,
      socket,
      states,
      events,
      last: () => states[states.length - 1],
      emit: (event, payload) =>
        new Promise((resolve) => socket.emit(event, payload ?? {}, resolve)),
      waitFor: (predicate, timeoutMs = 2000) =>
        new Promise((resolve, reject) => {
          const hit = states.at(-1);
          if (hit && predicate(hit)) {
            resolve(hit);
            return;
          }
          const timer = setTimeout(() => {
            socket.off('ROOM_STATE', listener);
            reject(new Error(`Timed out waiting for state; last=${states.at(-1)?.phase}`));
          }, timeoutMs);
          const listener = (state: PublicRoomState): void => {
            if (predicate(state)) {
              clearTimeout(timer);
              socket.off('ROOM_STATE', listener);
              resolve(state);
            }
          };
          socket.on('ROOM_STATE', listener);
        }),
      disconnect: () => {
        socket.disconnect();
      },
    };
    players.push(player);
    return player;
  }

  return {
    server,
    clock,
    baseUrl,
    api,
    newPlayer,
    async close() {
      for (const player of players) {
        player.socket.disconnect();
      }
      await server.close();
    },
  };
}
