import { randomBytes } from 'node:crypto';
import { chmodSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IMAGE_TOKEN_SECRET_FILE, loadImageTokenSecret } from '../../server/images/secret';
import { ImageTokens, TOKEN_PATTERN } from '../../server/images/tokens';
import { THUMB_URL } from './fixtures';

describe('ImageTokens', () => {
  it('issues opaque tokens, stable within a round and new for every round', () => {
    const tokens = new ImageTokens();
    const first = tokens.issue('round-1', THUMB_URL);
    expect(first).toMatch(TOKEN_PATTERN);
    expect(first).not.toContain('Lion');
    expect(Buffer.from(first, 'base64url').toString('latin1')).not.toMatch(/lion|wiki|upload/i);
    expect(tokens.issue('round-1', THUMB_URL)).toBe(first);
    expect(tokens.issue('round-2', THUMB_URL)).not.toBe(first);
    expect(tokens.resolve(first)?.url).toBe(THUMB_URL);
  });

  it('rejects unknown, malformed, tampered and expired tokens', () => {
    let now = 0;
    const tokens = new ImageTokens({ ttlMs: 1000, now: () => now });
    const token = tokens.issue('r', THUMB_URL);
    expect(tokens.resolve('A'.repeat(75))).toBeNull();
    expect(tokens.resolve('../../etc/passwd')).toBeNull();
    expect(tokens.resolve(`${token}x`)).toBeNull();
    const raw = Buffer.from(token, 'base64url');
    for (const index of [0, 13, 40, 55]) {
      const flipped = Buffer.from(raw);
      flipped[index] = (flipped[index] ?? 0) ^ 1;
      expect(tokens.resolve(flipped.toString('base64url'))).toBeNull();
    }
    expect(tokens.resolve(token)?.expiresAt).toBe(1000);
    now = 1000;
    expect(tokens.resolve(token)).toBeNull();
    const renewed = tokens.issue('r', THUMB_URL);
    expect(renewed).not.toBe(token);
    expect(tokens.size).toBe(1);
  });

  it('survives a restart with the same secret, not with another one', () => {
    const secret = randomBytes(32);
    const before = new ImageTokens({ secret });
    const token = before.issue('round-1', THUMB_URL);
    const after = new ImageTokens({ secret });
    expect(after.resolve(token)).toBeNull(); // the URL is not known yet
    after.register(THUMB_URL);
    expect(after.resolve(token)?.url).toBe(THUMB_URL);
    const other = new ImageTokens({ secret: randomBytes(32) });
    other.register(THUMB_URL);
    expect(other.resolve(token)).toBeNull();
    expect(() => new ImageTokens({ secret: Buffer.alloc(8) })).toThrow();
  });

  it('caps the memo; evicted tokens stay valid because they are signed', () => {
    const tokens = new ImageTokens({ maxEntries: 3 });
    const issued = ['a', 'b', 'c', 'd'].map((round) => tokens.issue(round, THUMB_URL));
    expect(tokens.size).toBe(3);
    expect(tokens.resolve(issued[0]!)?.url).toBe(THUMB_URL);
    expect(tokens.issue('b', THUMB_URL)).toBe(issued[1]);
  });
});

describe('loadImageTokenSecret', () => {
  it('uses IMAGE_TOKEN_SECRET, else generates and keeps a key in the data directory', () => {
    const fromEnv = loadImageTokenSecret('x'.repeat(40), null);
    expect(fromEnv.source).toBe('env');
    expect(loadImageTokenSecret('x'.repeat(40), null).secret).toEqual(fromEnv.secret);

    const dir = mkdtempSync(join(tmpdir(), 'encycla-secret-'));
    const generated = loadImageTokenSecret(null, dir);
    expect(generated.source).toBe('generated');
    const path = join(dir, IMAGE_TOKEN_SECRET_FILE);
    expect(readFileSync(path, 'utf8').trim()).toMatch(/^[0-9a-f]{64}$/);
    expect(statSync(path).mode & 0o777).toBe(0o600);
    const again = loadImageTokenSecret(undefined, dir);
    expect(again.source).toBe('file');
    expect(again.secret).toEqual(generated.secret);

    writeFileSync(path, 'garbage');
    expect(loadImageTokenSecret(null, dir).source).toBe('generated');
    expect(loadImageTokenSecret(null, null).source).toBe('ephemeral');
  });

  it('falls back to a per-process key when the volume is read-only', () => {
    const dir = mkdtempSync(join(tmpdir(), 'encycla-ro-'));
    chmodSync(dir, 0o500);
    try {
      const result = loadImageTokenSecret(null, join(dir, 'sub'));
      expect(['ephemeral', 'generated']).toContain(result.source); // root ignores permissions
    } finally {
      chmodSync(dir, 0o700);
    }
  });
});
