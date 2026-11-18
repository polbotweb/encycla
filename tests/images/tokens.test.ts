import { describe, expect, it } from 'vitest';
import { ImageTokens, TOKEN_PATTERN } from '../../server/images/tokens';
import { THUMB_URL } from './fixtures';

describe('ImageTokens', () => {
  it('issues opaque tokens, stable within a round and new for every round', () => {
    const tokens = new ImageTokens();
    const first = tokens.issue('round-1', THUMB_URL);
    expect(first).toMatch(TOKEN_PATTERN);
    expect(first).not.toContain('Lion');
    expect(tokens.issue('round-1', THUMB_URL)).toBe(first);
    expect(tokens.issue('round-2', THUMB_URL)).not.toBe(first);
    expect(tokens.resolve(first)?.url).toBe(THUMB_URL);
  });

  it('rejects unknown, malformed and expired tokens', () => {
    let now = 0;
    const tokens = new ImageTokens({ ttlMs: 1000, now: () => now });
    const token = tokens.issue('r', THUMB_URL);
    expect(tokens.resolve('A'.repeat(22))).toBeNull();
    expect(tokens.resolve('../../etc/passwd')).toBeNull();
    expect(tokens.resolve(`${token}x`)).toBeNull();
    expect(tokens.resolve(token)?.expiresAt).toBe(1000);
    now = 1000;
    expect(tokens.resolve(token)).toBeNull();
    const renewed = tokens.issue('r', THUMB_URL);
    expect(renewed).not.toBe(token);
    expect(tokens.size).toBe(1);
  });

  it('caps the table by dropping the oldest tokens', () => {
    const tokens = new ImageTokens({ maxEntries: 3 });
    const issued = ['a', 'b', 'c', 'd'].map((round) => tokens.issue(round, THUMB_URL));
    expect(tokens.size).toBe(3);
    expect(tokens.resolve(issued[0]!)).toBeNull();
    expect(tokens.resolve(issued[3]!)).not.toBeNull();
    expect(tokens.issue('b', THUMB_URL)).toBe(issued[1]);
  });
});
