/**
 * Load smoke test: plays N complete CONTEST matches (2 players each) in parallel against a
 * running server and reports ack latencies. Rooms cycle through fr, en and ar.
 *
 *   BASE_URL=http://localhost:3000 ROOMS=25 pnpm run test:load
 *
 * The server must run with RATE_LIMIT=off (outside production).
 * Exit code 1 on any error ack, timeout or when p95 ack latency exceeds P95_BUDGET_MS.
 */
import { io, type Socket } from 'socket.io-client';
import { LANGUAGES } from '../shared/languages';
import type { Ack } from '../shared/protocol';
import type { PublicRoomState } from '../shared/types';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const ROOMS = Number(process.env.ROOMS ?? 25);
const P95_BUDGET_MS = Number(process.env.P95_BUDGET_MS ?? 250);
const MATCH_TIMEOUT_MS = Number(process.env.MATCH_TIMEOUT_MS ?? 120_000);

const latencies: number[] = [];
const errors: string[] = [];

interface Client {
  token: string;
  socket: Socket;
  last: PublicRoomState | null;
}

async function api<T>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as T & { error?: { code: string } };
  if (!response.ok) {
    throw new Error(`${path} -> ${response.status} ${json.error?.code ?? ''}`);
  }
  return json;
}

function emit<T = unknown>(client: Client, event: string, payload: unknown = {}): Promise<Ack<T>> {
  const started = performance.now();
  return new Promise((resolve) => {
    client.socket.emit(event, payload, (ack: Ack<T>) => {
      latencies.push(performance.now() - started);
      if (!ack.ok) errors.push(`${event}: ${ack.error.code}`);
      resolve(ack);
    });
  });
}

async function connectPlayer(pseudo: string): Promise<Client> {
  const session = await api<{ token: string }>('/api/sessions', { pseudo });
  const socket = io(`${BASE_URL}/game`, {
    auth: { role: 'player', token: session.token },
    transports: ['websocket'],
    reconnection: false,
  });
  const client: Client = { token: session.token, socket, last: null };
  socket.on('ROOM_STATE', (state: PublicRoomState) => {
    client.last = state;
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('SESSION_READY', () => resolve());
    socket.once('connect_error', reject);
  });
  return client;
}

async function until(predicate: () => boolean, label: string): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > MATCH_TIMEOUT_MS) throw new Error(`timeout: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function playMatch(index: number): Promise<void> {
  const a = await connectPlayer(`LoadA${index}`);
  const b = await connectPlayer(`LoadB${index}`);
  try {
    const { roomCode } = await api<{ roomCode: string }>(
      '/api/rooms',
      { mode: 'CONTEST', language: LANGUAGES[index % LANGUAGES.length] },
      a.token,
    );
    await emit(a, 'ROOM_JOIN', { code: roomCode });
    await emit(b, 'ROOM_JOIN', { code: roomCode });
    await emit(a, 'LOBBY_READY', { ready: true });
    await emit(b, 'LOBBY_READY', { ready: true });
    await emit(a, 'GAME_START');

    const answered = new Map<Client, string>();
    const continued = new Map<Client, string>();
    while (a.last?.phase !== 'MATCH_OVER') {
      await until(
        () =>
          a.last?.phase === 'QUESTION' ||
          a.last?.phase === 'ARTICLE' ||
          a.last?.phase === 'MATCH_OVER' ||
          a.last?.phase === 'REVEAL',
        'phase change',
      );
      for (const client of [a, b]) {
        const state = client.last;
        if (
          state?.phase === 'QUESTION' &&
          state.question &&
          answered.get(client) !== state.question.id
        ) {
          answered.set(client, state.question.id);
          void emit(client, 'ANSWER', { questionId: state.question.id, choiceIndex: 0 });
        }
        if (
          (state?.phase === 'ARTICLE' || state?.phase === 'LEVEL_COMPLETE') &&
          state.phaseToken &&
          continued.get(client) !== state.phaseToken
        ) {
          continued.set(client, state.phaseToken);
          void emit(client, 'CONTINUE', { phaseToken: state.phaseToken });
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  } finally {
    a.socket.disconnect();
    b.socket.disconnect();
  }
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
}

async function main(): Promise<void> {
  console.info(`Load test: ${ROOMS} CONTEST matches (${ROOMS * 2} sockets) against ${BASE_URL}`);
  const started = Date.now();
  const results = await Promise.allSettled(
    Array.from({ length: ROOMS }, (_, index) => playMatch(index)),
  );
  const failed = results.filter((result) => result.status === 'rejected');
  for (const result of failed) errors.push(String((result as PromiseRejectedResult).reason));

  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);
  console.info(
    `matches ok: ${ROOMS - failed.length}/${ROOMS} in ${((Date.now() - started) / 1000).toFixed(1)}s | acks: ${latencies.length} | p50 ${p50.toFixed(1)} ms | p95 ${p95.toFixed(1)} ms | max ${Math.max(0, ...latencies).toFixed(1)} ms`,
  );
  if (errors.length > 0) {
    console.error(`${errors.length} error(s), first: ${errors[0]}`);
  }
  if (errors.length > 0 || p95 > P95_BUDGET_MS) {
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
