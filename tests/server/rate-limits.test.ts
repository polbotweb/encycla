import type { Server } from 'node:http';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../server/app';
import { apiRateLimit } from '../../server/security/rateLimit';
import { RATE_LIMITS } from '../../server/security/limits';

let server: Server | null = null;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  }
});

async function listen(app: express.Express): Promise<string> {
  server = app.listen(0);
  await new Promise<void>((resolve) => server!.once('listening', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no address');
  return `http://127.0.0.1:${address.port}`;
}

/** Tiny app: a valid session is any `Bearer ok-<id>` header. */
function limitedApp(limits = { anonymousPerIp: 3, perSession: 3, perIpCeiling: 8 }) {
  const app = express();
  app.use(
    apiRateLimit({
      now: () => 0,
      sessionOf: (request) => {
        const match = /^Bearer ok-(\w+)$/.exec(request.get('authorization') ?? '');
        return match ? match[1]! : null;
      },
      exempt: (request) => request.path === '/health',
      ...limits,
    }),
  );
  app.get('/health', (_request, response) => response.json({ ok: true }));
  app.get('/x', (_request, response) => response.json({ ok: true }));
  return app;
}

async function statuses(url: string, count: number, headers: Record<string, string> = {}) {
  const result: number[] = [];
  for (let index = 0; index < count; index += 1) {
    result.push((await fetch(url, { headers })).status);
  }
  return result;
}

describe('API rate limits behind shared addresses (D-118)', () => {
  it('counts signed-in requests per session, so players sharing an IP do not starve', async () => {
    const base = await listen(limitedApp());
    expect(await statuses(`${base}/x`, 4, { authorization: 'Bearer ok-a' })).toEqual([
      200, 200, 200, 429,
    ]);
    expect(await statuses(`${base}/x`, 3, { authorization: 'Bearer ok-b' })).toEqual([
      200, 200, 200,
    ]);
  });

  it('puts forged or missing tokens in the per-IP anonymous bucket', async () => {
    const base = await listen(limitedApp());
    expect(await statuses(`${base}/x`, 2, { authorization: 'Bearer forged' })).toEqual([200, 200]);
    expect(await statuses(`${base}/x`, 2)).toEqual([200, 429]);
  });

  it('caps every session from one IP with a ceiling', async () => {
    const base = await listen(limitedApp({ anonymousPerIp: 3, perSession: 3, perIpCeiling: 4 }));
    const seen = [
      ...(await statuses(`${base}/x`, 3, { authorization: 'Bearer ok-a' })),
      ...(await statuses(`${base}/x`, 2, { authorization: 'Bearer ok-b' })),
    ];
    expect(seen).toEqual([200, 200, 200, 200, 429]);
  });

  it('never limits the health probe', async () => {
    const base = await listen(limitedApp({ anonymousPerIp: 1, perSession: 1, perIpCeiling: 1 }));
    expect(await statuses(`${base}/health`, 5)).toEqual([200, 200, 200, 200, 200]);
  });

  it('answers 429 with Retry-After and the typed error', async () => {
    const base = await listen(limitedApp({ anonymousPerIp: 1, perSession: 1, perIpCeiling: 1 }));
    await fetch(`${base}/x`);
    const response = await fetch(`${base}/x`);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'RATE_LIMITED',
    );
  });

  it('limits admin routes strictly per IP in the real app', async () => {
    const app = createApp({ rateLimit: true, adminToken: 'a-long-enough-admin-token' });
    server = app.listen(0);
    await new Promise<void>((resolve) => server!.once('listening', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('no address');
    const base = `http://127.0.0.1:${address.port}`;
    const seen = await statuses(`${base}/api/admin/tiktok`, RATE_LIMITS.adminPerIp + 1, {
      authorization: 'Bearer wrong',
    });
    expect(seen.slice(0, RATE_LIMITS.adminPerIp).every((status) => status === 403)).toBe(true);
    expect(seen.at(-1)).toBe(429);
  });

  it('keeps public limits lenient enough for a shared classroom address', () => {
    expect(RATE_LIMITS.imagesPerIp).toBeGreaterThanOrEqual(1000);
    expect(RATE_LIMITS.apiPerIpCeiling).toBeGreaterThan(RATE_LIMITS.apiPerSession);
    expect(RATE_LIMITS.roomJoinPerIp).toBeGreaterThan(RATE_LIMITS.roomJoinPerPlayer);
  });
});
