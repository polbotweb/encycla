import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Router, type RequestHandler } from 'express';
import type { Persistence } from '../persistence/repositories';
import { routeGroup, type ServerMetrics } from '../observability/metrics';
import type { Logger } from '../util/logger';
import { adminAuth } from './auth';

/** Set by the shutdown path so `/readyz` turns 503 before the listener closes (D-123). */
export interface Readiness {
  shuttingDown: boolean;
}

const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;
/** Probes and assets are counted but not logged at `info` (they would drown the useful lines). */
const QUIET_GROUPS = new Set([
  '/healthz',
  '/readyz',
  '/metrics',
  '/api/health',
  '/img',
  '/assets',
  'static',
]);

/**
 * Access log + HTTP metrics. Each request gets an id (`X-Request-Id`, reused when the proxy sends
 * a well-formed one). Lines carry the route *group*, never the raw path or query (codes, tokens).
 */
export function requestObserver(metrics: ServerMetrics, logger: Logger): RequestHandler {
  return (request, response, next) => {
    const started = performance.now();
    const incoming = request.get('x-request-id');
    const id = incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    response.locals.requestId = id;
    response.setHeader('X-Request-Id', id);
    response.on('finish', () => {
      const seconds = (performance.now() - started) / 1000;
      const group = routeGroup(request.originalUrl.split('?')[0] ?? '/');
      const status = response.statusCode;
      metrics.httpRequests.inc({
        method: request.method,
        route: group,
        status: `${Math.floor(status / 100)}xx`,
      });
      metrics.httpDuration.observe(seconds, { route: group });
      if (status === 429) metrics.rateLimited.inc({ scope: 'http' });
      const level = status >= 500 ? 'error' : QUIET_GROUPS.has(group) ? 'debug' : 'info';
      logger.log(level, 'http.request', {
        rid: id,
        method: request.method,
        route: group,
        status,
        ms: Math.round(seconds * 10_000) / 10,
      });
    });
    next();
  };
}

export interface ObservabilityOptions {
  persistence: Persistence;
  questionsUsable: boolean;
  readiness: Readiness;
  metrics: ServerMetrics;
  adminToken: string | null;
  uptimeMs: () => number;
  version: string;
  /** Extra guard in front of `/metrics` (the admin rate limit). */
  metricsGuard?: RequestHandler;
}

export type DbCheck = 'ok' | 'memory' | 'error';

export function checkDatabase(persistence: Persistence): DbCheck {
  if (persistence.kind !== 'sqlite' || !persistence.db) return 'memory';
  try {
    persistence.db.prepare('SELECT 1').get();
    return 'ok';
  } catch {
    return 'error';
  }
}

/**
 * `/healthz`: liveness (the process answers). `/readyz`: readiness (questions loaded, database
 * answers, not shutting down). `/metrics`: Prometheus text, `Authorization: Bearer ADMIN_TOKEN`.
 */
export function createObservabilityRouter(options: ObservabilityOptions): Router {
  const router = Router();
  router.get('/healthz', (_request, response) => {
    response.set('Cache-Control', 'no-store');
    response.json({ status: 'ok', uptimeMs: options.uptimeMs(), version: options.version });
  });
  router.get('/readyz', (_request, response) => {
    const db = checkDatabase(options.persistence);
    const checks = {
      questions: options.questionsUsable ? 'ok' : 'error',
      db,
      shutdown: options.readiness.shuttingDown,
    };
    const ready = options.questionsUsable && db !== 'error' && !options.readiness.shuttingDown;
    response.set('Cache-Control', 'no-store');
    response.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', checks });
  });
  const guards: RequestHandler[] = options.metricsGuard ? [options.metricsGuard] : [];
  router.get('/metrics', ...guards, adminAuth(options.adminToken), (_request, response) => {
    response.set('Cache-Control', 'no-store');
    response
      .type('text/plain; version=0.0.4; charset=utf-8')
      .send(options.metrics.registry.render());
  });
  return router;
}
