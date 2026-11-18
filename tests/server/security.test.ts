import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { get, type IncomingMessage, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { brotliCompressSync, brotliDecompressSync, gzipSync, gunzipSync } from 'node:zlib';
import { createApp, type AppOptions } from '../../server/app';
import { acceptedEncodings } from '../../server/http/precompressed';

let server: Server | null = null;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  }
});

async function start(options: AppOptions = {}): Promise<string> {
  server = createApp(options).listen(0);
  await new Promise<void>((resolve) => server!.once('listening', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no address');
  return `http://127.0.0.1:${address.port}`;
}

describe('HTTP hardening', () => {
  it('sends a strict CSP without unsafe directives, plus HSTS and Permissions-Policy', async () => {
    const base = await start();
    const response = await fetch(`${base}/api/health`);
    const csp = response.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("img-src 'self';");
    expect(csp).not.toContain('wikimedia');
    expect(csp).not.toMatch(/unsafe-(inline|eval)/);
    expect(csp).not.toContain('data:');
    expect(response.headers.get('strict-transport-security')).toContain('max-age=');
    expect(response.headers.get('permissions-policy')).toContain('camera=()');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-powered-by')).toBeNull();
  });

  it('rejects bodies over 16 KB', async () => {
    const base = await start();
    const response = await fetch(`${base}/api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pseudo: 'x'.repeat(20_000) }),
    });
    expect(response.status).toBe(413);
  });

  it('rejects malformed JSON with a typed error', async () => {
    const base = await start();
    const response = await fetch(`${base}/api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR',
    );
  });

  it('rate limits POST /api/sessions at 10 per minute per IP', async () => {
    const base = await start({ rateLimit: true });
    const statuses: number[] = [];
    for (let index = 0; index < 12; index += 1) {
      const response = await fetch(`${base}/api/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pseudo: `Player${index}` }),
      });
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 10).every((status) => status === 201)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });

  it('requires a valid admin bearer token on admin routes', async () => {
    const base = await start({ adminToken: 'a-long-enough-admin-token' });
    expect((await fetch(`${base}/api/admin/rooms/ABCDEF/close`, { method: 'POST' })).status).toBe(
      401,
    );
    const wrong = await fetch(`${base}/api/admin/rooms/ABCDEF/close`, {
      method: 'POST',
      headers: { authorization: 'Bearer nope' },
    });
    expect(wrong.status).toBe(403);
    const right = await fetch(`${base}/api/admin/rooms/ABCDEF/close`, {
      method: 'POST',
      headers: { authorization: 'Bearer a-long-enough-admin-token' },
    });
    expect(right.status).toBe(404);
  });

  it('never grants admin access when no admin token is configured', async () => {
    const base = await start({ adminToken: null });
    const response = await fetch(`${base}/api/admin/rooms/ABCDEF/close`, {
      method: 'POST',
      headers: { authorization: 'Bearer anything' },
    });
    expect(response.status).toBe(403);
  });

  it('requires a session for player routes and rejects malformed tokens', async () => {
    const base = await start();
    expect((await fetch(`${base}/api/rooms`, { method: 'POST' })).status).toBe(401);
    const bad = await fetch(`${base}/api/rooms`, {
      method: 'POST',
      headers: { authorization: 'Bearer not-a-session' },
    });
    expect(bad.status).toBe(401);
  });
});

describe('static serving', () => {
  it('caches hashed assets, revalidates the shell and keeps /api out of the SPA fallback', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'encycla-static-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Encycla</title>');
    writeFileSync(join(dir, 'assets', 'index-abc123.js'), 'console.log(1)');
    const base = await start({ staticDir: dir });

    const asset = await fetch(`${base}/assets/index-abc123.js`);
    expect(asset.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');

    const shell = await fetch(`${base}/`);
    expect(shell.status).toBe(200);
    expect(shell.headers.get('cache-control')).toBe('no-cache');

    const deepLink = await fetch(`${base}/some/client/route`);
    expect(await deepLink.text()).toContain('<title>Encycla</title>');

    const api = await fetch(`${base}/api/unknown`);
    expect(api.status).toBe(404);
    expect(api.headers.get('content-type')).toContain('application/json');
  });
});

function raw(
  url: string,
  headers: Record<string, string>,
): Promise<{ response: IncomingMessage; body: Buffer }> {
  return new Promise((resolvePromise, reject) => {
    get(url, { headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolvePromise({ response, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

describe('precompressed assets', () => {
  it('parses Accept-Encoding with q-values', () => {
    expect([...acceptedEncodings('gzip, deflate, br')]).toEqual(['gzip', 'deflate', 'br']);
    expect([...acceptedEncodings('br;q=0, gzip;q=0.5')]).toEqual(['gzip']);
    expect(acceptedEncodings(undefined).size).toBe(0);
  });

  it('sends brotli, then gzip, then identity, with the original type and Vary', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'encycla-static-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Encycla</title>');
    const source = 'console.log("encycla");'.repeat(100);
    writeFileSync(join(dir, 'assets', 'app-1.js'), source);
    writeFileSync(join(dir, 'assets', 'app-1.js.br'), brotliCompressSync(source));
    writeFileSync(join(dir, 'assets', 'app-1.js.gz'), gzipSync(source));
    writeFileSync(join(dir, 'assets', 'plain-1.js'), source);
    const base = await start({ staticDir: dir });

    const br = await raw(`${base}/assets/app-1.js`, { 'accept-encoding': 'gzip, br' });
    expect(br.response.headers['content-encoding']).toBe('br');
    expect(br.response.headers['content-type']).toContain('javascript');
    expect(br.response.headers.vary).toContain('Accept-Encoding');
    expect(br.response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(brotliDecompressSync(br.body).toString()).toBe(source);

    const gz = await raw(`${base}/assets/app-1.js`, { 'accept-encoding': 'gzip' });
    expect(gz.response.headers['content-encoding']).toBe('gzip');
    expect(gunzipSync(gz.body).toString()).toBe(source);

    const identity = await raw(`${base}/assets/app-1.js`, { 'accept-encoding': 'identity' });
    expect(identity.response.headers['content-encoding']).toBeUndefined();
    expect(identity.response.headers.vary).toContain('Accept-Encoding');
    expect(identity.body.toString()).toBe(source);

    const plain = await raw(`${base}/assets/plain-1.js`, { 'accept-encoding': 'br' });
    expect(plain.response.headers['content-encoding']).toBeUndefined();

    const traversal = await raw(`${base}/assets/..%2f..%2fetc%2fpasswd`, {
      'accept-encoding': 'br',
    });
    expect(traversal.response.headers['content-encoding']).toBeUndefined();
  });
});
