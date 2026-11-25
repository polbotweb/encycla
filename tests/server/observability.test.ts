import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, type AppOptions } from '../../server/app';
import {
  MetricsRegistry,
  createServerMetrics,
  escapeLabel,
  routeGroup,
} from '../../server/observability/metrics';
import { checkDatabase } from '../../server/http/observability';
import { createMemoryPersistence } from '../../server/persistence/db';
import type { Persistence } from '../../server/persistence/repositories';
import type { LogLevel, Logger } from '../../server/util/logger';

const ADMIN = 'observability-admin-token-0123456789';
let server: Server | null = null;

async function start(options: AppOptions = {}): Promise<string> {
  server = createApp({ adminToken: ADMIN, ...options }).listen(0);
  await new Promise<void>((resolve) => server!.once('listening', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no TCP address');
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = null;
});

function captureLogger(): {
  logger: Logger;
  lines: { level: LogLevel; event: string; data?: Record<string, unknown> }[];
} {
  const lines: { level: LogLevel; event: string; data?: Record<string, unknown> }[] = [];
  return {
    lines,
    logger: {
      log: (level, event, data) => lines.push({ level, event, ...(data ? { data } : {}) }),
    },
  };
}

describe('/healthz and /readyz (D-123)', () => {
  it('liveness always answers while the process runs', async () => {
    const base = await start({ questionsUsable: false });
    const response = await fetch(`${base}/healthz`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ status: 'ok', version: '1.0.0' });
  });

  it('readiness is 200 with questions and a memory database', async () => {
    const base = await start();
    const response = await fetch(`${base}/readyz`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ready',
      checks: { questions: 'ok', db: 'memory', shutdown: false },
    });
  });

  it('readiness is 503 without usable questions or while shutting down', async () => {
    const readiness = { shuttingDown: false };
    const base = await start({ questionsUsable: false, readiness });
    let response = await fetch(`${base}/readyz`);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      status: 'not_ready',
      checks: { questions: 'error' },
    });

    await new Promise<void>((resolve) => server!.close(() => resolve()));
    const base2 = await start({ readiness });
    readiness.shuttingDown = true;
    response = await fetch(`${base2}/readyz`);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ checks: { shutdown: true } });
  });

  it('checks the database with a real query', () => {
    expect(checkDatabase(createMemoryPersistence())).toBe('memory');
    const broken = {
      kind: 'sqlite',
      db: {
        prepare: () => {
          throw new Error('disk I/O error');
        },
      },
    } as unknown as Persistence;
    expect(checkDatabase(broken)).toBe('error');
    const fine = {
      kind: 'sqlite',
      db: { prepare: () => ({ get: () => ({ 1: 1 }) }) },
    } as unknown as Persistence;
    expect(checkDatabase(fine)).toBe('ok');
  });
});

describe('/metrics (D-123)', () => {
  it('requires the admin token', async () => {
    const base = await start();
    expect((await fetch(`${base}/metrics`)).status).toBe(401);
    const wrong = await fetch(`${base}/metrics`, {
      headers: { authorization: 'Bearer nope-nope-nope' },
    });
    expect(wrong.status).toBe(403);
  });

  it('is closed when no admin token is configured', async () => {
    const base = await start({ adminToken: null });
    const response = await fetch(`${base}/metrics`, {
      headers: { authorization: `Bearer ${ADMIN}` },
    });
    expect(response.status).toBe(403);
  });

  it('serves Prometheus text with HTTP, room and process metrics', async () => {
    const base = await start();
    await fetch(`${base}/api/config`);
    await fetch(`${base}/api/rooms/ABCDEF?token=secret`);
    const response = await fetch(`${base}/metrics`, {
      headers: { authorization: `Bearer ${ADMIN}` },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain; version=0.0.4');
    const text = await response.text();
    expect(text).toContain('# TYPE encycla_http_requests_total counter');
    expect(text).toMatch(
      /encycla_http_requests_total\{method="GET",route="\/api\/config",status="2xx"\} 1/,
    );
    expect(text).toContain('route="/api/rooms"');
    expect(text).not.toContain('ABCDEF');
    expect(text).not.toContain('secret');
    expect(text).toMatch(
      /encycla_http_request_duration_seconds_bucket\{route="\/api\/config",le="\+Inf"\} 1/,
    );
    expect(text).toContain('encycla_rooms 0');
    expect(text).toMatch(/encycla_build_info\{node="v[\d.]+",version="1\.0\.0"\} 1/);
    expect(text).toMatch(/encycla_process_resident_memory_bytes \d+/);
  });
});

describe('access log and request ids (D-123)', () => {
  it('logs API requests by route group with a request id, probes only at debug', async () => {
    const { logger, lines } = captureLogger();
    const base = await start({ logger });
    const response = await fetch(`${base}/api/config`, {
      headers: { 'x-request-id': 'proxy-id-12345678' },
    });
    expect(response.headers.get('x-request-id')).toBe('proxy-id-12345678');
    const generated = await fetch(`${base}/healthz`, {
      headers: { 'x-request-id': 'bad id with spaces' },
    });
    expect(generated.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const api = lines.find((line) => line.data?.route === '/api/config');
    expect(api).toMatchObject({
      level: 'info',
      event: 'http.request',
      data: { rid: 'proxy-id-12345678', method: 'GET', status: 200 },
    });
    expect(lines.find((line) => line.data?.route === '/healthz')?.level).toBe('debug');
  });
});

describe('metrics primitives', () => {
  it('groups routes without ids, codes or tokens', () => {
    expect(routeGroup('/api/rooms/ABC123/join')).toBe('/api/rooms');
    expect(routeGroup('/api/admin/rooms/ABC123/close')).toBe('/api/admin/rooms');
    expect(routeGroup('/api/admin/whatever')).toBe('/api/admin');
    expect(routeGroup('/api/unknown/x')).toBe('/api/other');
    expect(routeGroup('/img/abcdef')).toBe('/img');
    expect(routeGroup('/assets/app.js')).toBe('/assets');
    expect(routeGroup('/play/solo')).toBe('static');
    expect(routeGroup('/metrics')).toBe('/metrics');
  });

  it('escapes labels and skips failing gauges', () => {
    expect(escapeLabel('a"b\\c\nd')).toBe('a\\"b\\\\c\\nd');
    const registry = new MetricsRegistry();
    registry.gauge('broken', 'Throws.', () => {
      throw new Error('boom');
    });
    registry.gauge('labelled', 'Labelled.', () => [{ labels: { kind: 'x' }, value: 2 }]);
    const counter = registry.counter('hits_total', 'Hits.');
    counter.inc({ b: '2', a: '1' });
    counter.inc({ a: '1', b: '2' }, 2);
    expect(counter.get({ a: '1', b: '2' })).toBe(3);
    const text = registry.render();
    expect(text).toContain('# TYPE broken gauge\n# HELP labelled');
    expect(text).toContain('labelled{kind="x"} 2');
    expect(text).toContain('hits_total{a="1",b="2"} 3');
  });

  it('renders cumulative histogram buckets', () => {
    const registry = new MetricsRegistry();
    const histogram = registry.histogram('d_seconds', 'D.', [0.1, 1]);
    histogram.observe(0.05);
    histogram.observe(0.5);
    histogram.observe(3);
    const text = registry.render();
    expect(text).toContain('d_seconds_bucket{le="0.1"} 1');
    expect(text).toContain('d_seconds_bucket{le="1"} 2');
    expect(text).toContain('d_seconds_bucket{le="+Inf"} 3');
    expect(text).toContain('d_seconds_sum 3.55');
    expect(text).toContain('d_seconds_count 3');
  });

  it('reports uptime from the injected clock', () => {
    let t = 1_000;
    const metrics = createServerMetrics({ now: () => t, version: 'test' });
    t += 42_000;
    expect(metrics.registry.render()).toContain('encycla_uptime_seconds 42');
    metrics.stop();
  });
});
