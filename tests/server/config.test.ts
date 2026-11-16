import { describe, expect, it } from 'vitest';
import { loadConfig, validateConfig } from '../../server/config';

describe('loadConfig', () => {
  it('uses documented defaults', () => {
    expect(loadConfig({})).toEqual({
      port: 3000,
      publicOrigin: null,
      databasePath: 'data/encycla.db',
      logLevel: 'info',
      adminToken: null,
      tiktokEnabled: false,
      tiktokUsername: null,
      tiktokSessionCookie: null,
      trustProxy: false,
      rateLimit: true,
      staticDir: 'dist/client',
    });
  });

  it('never accepts the placeholder or a short admin token', () => {
    expect(loadConfig({ ADMIN_TOKEN: 'change-me' }).adminToken).toBeNull();
    expect(loadConfig({ ADMIN_TOKEN: 'short' }).adminToken).toBeNull();
    expect(loadConfig({ ADMIN_TOKEN: 'a-long-enough-admin-token' }).adminToken).toBe(
      'a-long-enough-admin-token',
    );
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
      ADMIN_TOKEN: 'a-long-enough-admin-token',
      PUBLIC_ORIGIN: 'https://encycla.example.com',
    };
    expect(validateConfig(loadConfig(env), env)).toEqual([]);
  });

  it('refuses to disable rate limiting in production', () => {
    const env = {
      NODE_ENV: 'production',
      ADMIN_TOKEN: 'a-long-enough-admin-token',
      PUBLIC_ORIGIN: 'https://encycla.example.com',
      RATE_LIMIT: 'off',
    };
    expect(validateConfig(loadConfig(env), env)).toHaveLength(1);
    expect(validateConfig(loadConfig({ RATE_LIMIT: 'off' }), {})).toEqual([]);
  });

  it('requires a username and a session cookie when TikTok is enabled', () => {
    expect(validateConfig(loadConfig({ TIKTOK_ENABLED: 'true' }), {})).toHaveLength(2);
    const env = {
      TIKTOK_ENABLED: 'true',
      TIKTOK_USERNAME: 'game',
      TIKTOK_SESSION_COOKIE: 'sessionid=abc',
    };
    expect(validateConfig(loadConfig(env), {})).toEqual([]);
  });
});
