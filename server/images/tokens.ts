import { randomBytes } from 'node:crypto';

interface TokenEntry {
  url: string;
  key: string;
  expiresAt: number;
}

export interface ImageTokenOptions {
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
}

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

/**
 * Opaque, short-lived image handles: `/img/<token>` says nothing about the file. One token per
 * round and picture (stable across the snapshots of that round, different in every round), kept
 * in memory only: a token cannot be guessed (128 random bits) and dies with the process.
 */
export class ImageTokens {
  private readonly byToken = new Map<string, TokenEntry>();
  private readonly byKey = new Map<string, string>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: ImageTokenOptions = {}) {
    this.ttlMs = options.ttlMs ?? 2 * 60 * 60 * 1000;
    this.maxEntries = options.maxEntries ?? 50_000;
    this.now = options.now ?? Date.now;
  }

  issue(roundId: string, url: string): string {
    const key = `${roundId}\n${url}`;
    const now = this.now();
    const existing = this.byKey.get(key);
    if (existing) {
      const entry = this.byToken.get(existing);
      if (entry && entry.expiresAt > now) return existing;
    }
    this.prune(now);
    const token = randomBytes(16).toString('base64url');
    this.byToken.set(token, { url, key, expiresAt: now + this.ttlMs });
    this.byKey.set(key, token);
    return token;
  }

  resolve(token: string): { url: string; expiresAt: number } | null {
    if (!TOKEN_PATTERN.test(token)) return null;
    const entry = this.byToken.get(token);
    if (!entry || entry.expiresAt <= this.now()) return null;
    return { url: entry.url, expiresAt: entry.expiresAt };
  }

  get size(): number {
    return this.byToken.size;
  }

  private prune(now: number): void {
    for (const [token, entry] of this.byToken) {
      if (entry.expiresAt <= now) this.remove(token, entry);
    }
    // Map iteration is insertion order: the oldest tokens go first when the table is full.
    for (const [token, entry] of this.byToken) {
      if (this.byToken.size < this.maxEntries) break;
      this.remove(token, entry);
    }
  }

  private remove(token: string, entry: TokenEntry): void {
    this.byToken.delete(token);
    if (this.byKey.get(entry.key) === token) this.byKey.delete(entry.key);
  }
}
