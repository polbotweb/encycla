import { describe, expect, it } from 'vitest';
import { adminTokenProblem, loadConfig, validateConfig } from '../../server/config';

// Built at runtime so secret scanners do not mistake a test value for a leaked token.
const STRONG = 'k7Qm2Xv9'.repeat(8);

describe('loadConfig', () => {
  it('uses documented defaults', () => {
    expect(loadConfig({})).toEqual({
      port: 3000,
      publicOrigin: null,
      databasePath: 'data/encycla.db',
      logLevel: 'info',
      adminToken: null,
      tiktokEnabled: false,
      tiktokAdapter: 'live',
      tiktokUsername: null,
      tiktokSessionCookie: null,
      tiktokSignApiKey: null,
      trustProxy: false,
      rateLimit: true,
      staticDir: 'dist/client',
      imageCacheDir: 'data/image-cache',
      imageCacheMaxBytes: 512 * 1024 * 1024,
    });
  });

  it('never accepts the placeholder or a short admin token', () => {
    expect(loadConfig({ ADMIN_TOKEN: 'change-me' }).adminToken).toBeNull();
    expect(loadConfig({ ADMIN_TOKEN: 'short' }).adminToken).toBeNull();
    expect(loadConfig({ ADMIN_TOKEN: 'a-long-enough-admin-token' }).adminToken).toBe(
      'a-long-enough-admin-token',
    );
  });

  it('trusts a bounded number of proxies, never every hop', () => {
    expect(loadConfig({}).trustProxy).toBe(false);
    expect(loadConfig({ TRUST_PROXY: 'false' }).trustProxy).toBe(false);
    expect(loadConfig({ TRUST_PROXY: 'true' }).trustProxy).toBe(1);
    expect(loadConfig({ TRUST_PROXY: '2' }).trustProxy).toBe(2);
    expect(() => loadConfig({ TRUST_PROXY: 'yes' })).toThrow('Invalid TRUST_PROXY');
  });

  it('rejects an invalid port', () => {
    expect(() => loadConfig({ PORT: '0' })).toThrow('Invalid PORT');
    expect(() => loadConfig({ PORT: 'not-a-port' })).toThrow('Invalid PORT');
  });
});

describe('validateConfig', () => {
  it('accepts development defaults', () => {
    expect(validateConfig(loadConfig({}), {})).toEqual([]);
  });

  it('requires ADMIN_TOKEN and PUBLIC_ORIGIN in production', () => {
    const problems = validateConfig(loadConfig({ NODE_ENV: 'production' }), {
      NODE_ENV: 'production',
    });
    expect(problems).toHaveLength(2);
    expect(problems.join(' ')).toContain('ADMIN_TOKEN');
    expect(problems.join(' ')).toContain('PUBLIC_ORIGIN');
    const env = {
      NODE_ENV: 'production',
      ADMIN_TOKEN: STRONG,
      PUBLIC_ORIGIN: 'https://encycla.example.com',
    };
    expect(validateConfig(loadConfig(env), env)).toEqual([]);
  });

  it('refuses to disable rate limiting in production', () => {
    const env = {
      NODE_ENV: 'production',
      ADMIN_TOKEN: STRONG,
      PUBLIC_ORIGIN: 'https://encycla.example.com',
      RATE_LIMIT: 'off',
    };
    expect(validateConfig(loadConfig(env), env)).toHaveLength(1);
    expect(validateConfig(loadConfig({ RATE_LIMIT: 'off' }), {})).toEqual([]);
  });

  it('requires a session cookie for the live adapter; the live may be named per room', () => {
    expect(validateConfig(loadConfig({ TIKTOK_ENABLED: 'true' }), {})).toHaveLength(1);
    const anyLive = { TIKTOK_ENABLED: 'true', TIKTOK_SESSION_COOKIE: 'sessionid=abc' };
    expect(validateConfig(loadConfig(anyLive), {})).toEqual([]);
    expect(
      validateConfig(loadConfig({ ...anyLive, TIKTOK_USERNAME: 'not a handle!' }), {}),
    ).toHaveLength(1);
    const bad = { TIKTOK_ENABLED: 'true', TIKTOK_ADAPTER: 'nope' };
    expect(validateConfig(loadConfig(bad), bad)).toHaveLength(2);
    const fake = { TIKTOK_ENABLED: 'true', TIKTOK_ADAPTER: 'fake' };
    expect(validateConfig(loadConfig(fake), fake)).toEqual([]);
    const env = {
      TIKTOK_ENABLED: 'true',
      TIKTOK_USERNAME: 'game',
      TIKTOK_SESSION_COOKIE: 'sessionid=abc',
    };
    expect(validateConfig(loadConfig(env), {})).toEqual([]);
  });

  it('fails fast on a weak ADMIN_TOKEN in production instead of disabling the admin routes', () => {
    const base = { NODE_ENV: 'production', PUBLIC_ORIGIN: 'https://encycla.example.com' };
    for (const token of ['change-me', 'a-long-enough-admin-token', 'a'.repeat(40), `${STRONG} x`]) {
      const env = { ...base, ADMIN_TOKEN: token };
      const problems = validateConfig(loadConfig(env), env);
      expect(problems, token).toHaveLength(1);
      expect(problems[0]).toMatch(/^ADMIN_TOKEN /);
      expect(problems[0]).not.toContain(token);
    }
  });

  it('outside production tolerates the .env.example placeholder but rejects other weak tokens', () => {
    expect(
      validateConfig(loadConfig({ ADMIN_TOKEN: 'change-me' }), { ADMIN_TOKEN: 'change-me' }),
    ).toEqual([]);
    expect(
      validateConfig(loadConfig({ ADMIN_TOKEN: 'short' }), { ADMIN_TOKEN: 'short' }),
    ).toHaveLength(1);
    const ok = { ADMIN_TOKEN: 'a-long-enough-admin-token' };
    expect(validateConfig(loadConfig(ok), ok)).toEqual([]);
  });

  it('requires an https PUBLIC_ORIGIN without a path in production', () => {
    for (const origin of ['http://encycla.example.com', 'https://encycla.example.com/app']) {
      const env = { NODE_ENV: 'production', ADMIN_TOKEN: STRONG, PUBLIC_ORIGIN: origin };
      expect(validateConfig(loadConfig(env), env).join(' '), origin).toContain('PUBLIC_ORIGIN');
    }
  });

  it('explains what is wrong with a token', () => {
    expect(adminTokenProblem('changeme', false)).toMatch(/placeholder/);
    expect(adminTokenProblem('abcdefghijklmnop', true)).toMatch(/32/);
    expect(adminTokenProblem('abababababababababababababababab', true)).toMatch(/random/);
    expect(adminTokenProblem(STRONG, true)).toBeNull();
  });

  it('reads the optional TikTok signing key', () => {
    expect(loadConfig({ TIKTOK_SIGN_API_KEY: ' key ' }).tiktokSignApiKey).toBe('key');
  });
});
