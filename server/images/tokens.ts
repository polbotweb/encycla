import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export interface ImageTokenOptions {
  /** Server secret (≥ 32 bytes). Persisted (`IMAGE_TOKEN_SECRET` or the data volume) so links survive a restart. */
  secret?: Buffer;
  ttlMs?: number;
  /** Size of the memo that keeps a token stable within a round. */
  maxEntries?: number;
  now?: () => number;
}

/** 12-byte synthetic IV + 28-byte payload + 16-byte GCM tag = 56 bytes = 75 base64url characters. */
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{75}$/;

const REF_BYTES = 16;
const ROUND_BYTES = 8;
const PAYLOAD_BYTES = REF_BYTES + 4 + ROUND_BYTES;

/** Domain-separated sub-key of the server secret. */
export function deriveKey(secret: Buffer, label: string): Buffer {
  return createHmac('sha256', secret).update(`encycla/${label}/v1`).digest();
}

/**
 * Opaque, signed, expiring image handles (D-116): `/img/<token>` says nothing about the file and
 * survives a restart. The token is an AES-256-GCM encryption of
 * `ref(16) | expiresAt(uint32, s) | round(8)` where `ref` is a hash of the Commons URL (never the
 * filename) and `round` a hash of the round id; its IV is an HMAC-SHA-256 of that payload (SIV
 * construction), which makes the token deterministic for a round and lets the server check the
 * signature after decryption. The URL behind a `ref` is looked up in a table filled from the
 * question bank at startup and from every snapshot, so nothing secret is stored on disk except
 * the key.
 */
export class ImageTokens {
  private readonly encKey: Buffer;
  private readonly macKey: Buffer;
  private readonly refs = new Map<string, string>();
  /** `round\nurl` → token, so a round shows one URL in every snapshot. */
  private readonly memo = new Map<string, { token: string; expiresAt: number }>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: ImageTokenOptions = {}) {
    const secret = options.secret ?? randomBytes(32);
    if (secret.length < 32) throw new Error('Image token secret must be at least 32 bytes');
    this.encKey = deriveKey(secret, 'image-token-enc');
    this.macKey = deriveKey(secret, 'image-token-mac');
    this.ttlMs = options.ttlMs ?? 2 * 60 * 60 * 1000;
    this.maxEntries = options.maxEntries ?? 50_000;
    this.now = options.now ?? Date.now;
  }

  private static refOf(url: string): Buffer {
    return createHash('sha256').update(url).digest().subarray(0, REF_BYTES);
  }

  /** Makes a URL resolvable (the question bank at startup; every proxied picture). */
  register(url: string): void {
    this.refs.set(ImageTokens.refOf(url).toString('hex'), url);
  }

  issue(roundId: string, url: string): string {
    this.register(url);
    const key = `${roundId}\n${url}`;
    const now = this.now();
    const existing = this.memo.get(key);
    if (existing && existing.expiresAt > now) return existing.token;
    this.prune(now);
    const expiresAt = Math.ceil((now + this.ttlMs) / 1000) * 1000;
    const payload = Buffer.alloc(PAYLOAD_BYTES);
    ImageTokens.refOf(url).copy(payload, 0);
    payload.writeUInt32BE(Math.floor(expiresAt / 1000), REF_BYTES);
    createHash('sha256')
      .update(roundId)
      .digest()
      .copy(payload, REF_BYTES + 4, 0, ROUND_BYTES);
    const iv = this.sivOf(payload);
    const cipher = createCipheriv('aes-256-gcm', this.encKey, iv);
    const body = Buffer.concat([cipher.update(payload), cipher.final()]);
    const token = Buffer.concat([iv, body, cipher.getAuthTag()]).toString('base64url');
    this.memo.set(key, { token, expiresAt });
    return token;
  }

  resolve(token: string): { url: string; expiresAt: number } | null {
    if (!TOKEN_PATTERN.test(token)) return null;
    const raw = Buffer.from(token, 'base64url');
    if (raw.length !== 12 + PAYLOAD_BYTES + 16) return null;
    const iv = raw.subarray(0, 12);
    let payload: Buffer;
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.encKey, iv);
      decipher.setAuthTag(raw.subarray(12 + PAYLOAD_BYTES));
      payload = Buffer.concat([
        decipher.update(raw.subarray(12, 12 + PAYLOAD_BYTES)),
        decipher.final(),
      ]);
    } catch {
      return null;
    }
    if (!timingSafeEqual(this.sivOf(payload), iv)) return null;
    const expiresAt = payload.readUInt32BE(REF_BYTES) * 1000;
    if (expiresAt <= this.now()) return null;
    const url = this.refs.get(payload.subarray(0, REF_BYTES).toString('hex'));
    return url ? { url, expiresAt } : null;
  }

  /** Tokens remembered for the running rounds. */
  get size(): number {
    return this.memo.size;
  }

  private sivOf(payload: Buffer): Buffer {
    return createHmac('sha256', this.macKey).update(payload).digest().subarray(0, 12);
  }

  private prune(now: number): void {
    for (const [key, entry] of this.memo) {
      if (entry.expiresAt <= now) this.memo.delete(key);
    }
    // Insertion order: the oldest go first. An evicted token stays valid (it is signed); only
    // its stability within the round is lost.
    for (const key of this.memo.keys()) {
      if (this.memo.size < this.maxEntries) break;
      this.memo.delete(key);
    }
  }
}
