import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../server/config';

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
      trustProxy: false,
      staticDir: 'dist',
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
