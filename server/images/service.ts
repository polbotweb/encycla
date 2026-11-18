import { createHash, createHmac, randomBytes } from 'node:crypto';
import { Router, type Request, type Response as ExpressResponse } from 'express';
import type { ImageView, PublicRoomState } from '../../shared/types';
import { FixedWindowLimiter } from '../security/rateLimit';
import { stripMetadata, sniffImageType } from './metadata';
import { ImageStore } from './store';
import { ImageTokens } from './tokens';
import { availableWidths, isProxyableImage, parseWidth, upstreamUrl } from './upstream';

export const USER_AGENT =
  'EncyclaImageProxy/1.0 (https://github.com/polbotweb/encycla; educational quiz game)';
const MAX_UPSTREAM_BYTES = 10 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 10_000;
/** Random zero padding after the image end marker (ignored by decoders), per token and width. */
const MAX_PADDING = 16 * 1024;

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export interface ImageServiceOptions {
  cacheDir?: string | null;
  maxDiskBytes?: number;
  maxMemoryBytes?: number;
  tokenTtlMs?: number;
  now?: () => number;
  fetcher?: Fetcher;
  /** Requests per minute and IP on /img (null: no limit, tests and load tests only). */
  rateLimitPerMinute?: number | null;
}

/**
 * Serves the game pictures from our own origin, so nothing in a snapshot names the file before
 * the reveal (D-107). Clients only ever see `/img/<opaque token>?w=330|500|960`.
 */
export class ImageService {
  readonly tokens: ImageTokens;
  readonly store: ImageStore;
  private readonly secret = randomBytes(32);
  private readonly fetcher: Fetcher;
  private readonly now: () => number;
  private readonly inflight = new Map<string, Promise<Buffer | null>>();
  private readonly limiter: FixedWindowLimiter | null;
  upstreamRequests = 0;

  constructor(options: ImageServiceOptions = {}) {
    this.now = options.now ?? Date.now;
    this.tokens = new ImageTokens({
      now: this.now,
      ...(options.tokenTtlMs === undefined ? {} : { ttlMs: options.tokenTtlMs }),
    });
    this.store = new ImageStore({
      dir: options.cacheDir ?? null,
      ...(options.maxDiskBytes === undefined ? {} : { maxDiskBytes: options.maxDiskBytes }),
      ...(options.maxMemoryBytes === undefined ? {} : { maxMemoryBytes: options.maxMemoryBytes }),
    });
    this.fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
    const perMinute = options.rateLimitPerMinute === undefined ? 300 : options.rateLimitPerMinute;
    this.limiter = perMinute === null ? null : new FixedWindowLimiter(perMinute, 60_000, this.now);
  }

  /** Replaces every picture of a snapshot by an opaque same-origin URL. */
  publicView = (state: PublicRoomState): PublicRoomState => {
    const question = state.question
      ? { ...state.question, image: this.proxied(state.question.id, state.question.image, false) }
      : null;
    const reveal = state.reveal
      ? { ...state.reveal, image: this.proxied(state.reveal.questionId, state.reveal.image, true) }
      : null;
    return { ...state, question, reveal };
  };

  private proxied(roundId: string, image: ImageView | null, revealed: boolean): ImageView | null {
    if (!image || !isProxyableImage(image.url)) return null;
    const url = `/img/${this.tokens.issue(roundId, image.url)}`;
    const widths = availableWidths(image.url);
    const base = { url, alt: image.alt, ...(widths.length > 0 ? { widths } : {}) };
    if (!revealed) return base;
    return {
      ...base,
      ...(image.credit ? { credit: image.credit } : {}),
      ...(image.license ? { license: image.license } : {}),
      ...(image.sourceUrl ? { sourceUrl: image.sourceUrl } : {}),
    };
  }

  router(): Router {
    const router = Router();
    router.get('/img/:token', (request, response) => {
      void this.handle(request, response);
    });
    return router;
  }

  private refuse(response: ExpressResponse, status: number): void {
    response.status(status).setHeader('Cache-Control', 'no-store');
    response.type('text/plain').send(status === 429 ? 'Too many requests' : 'Image unavailable');
  }

  private async handle(request: Request, response: ExpressResponse): Promise<void> {
    if (this.limiter && !this.limiter.hit(request.ip ?? 'unknown')) {
      this.refuse(response, 429);
      return;
    }
    const token = String(request.params.token ?? '');
    const width = parseWidth(request.query.w);
    const entry = this.tokens.resolve(token);
    if (width === null) {
      this.refuse(response, 400);
      return;
    }
    if (!entry) {
      this.refuse(response, 404);
      return;
    }
    const upstream = upstreamUrl(entry.url, width);
    if (!upstream) {
      this.refuse(response, 404);
      return;
    }
    const bytes = await this.load(upstream);
    const type = bytes ? sniffImageType(bytes) : null;
    if (!bytes || !type) {
      this.refuse(response, 502);
      return;
    }

    const mac = createHmac('sha256', this.secret).update(`${token}\n${width}`).digest();
    const padding = mac.readUInt16BE(0) % MAX_PADDING;
    const body = Buffer.concat([bytes, Buffer.alloc(padding)]);
    const etag = `"${createHash('sha256').update(mac).update(bytes).digest('base64url').slice(0, 27)}"`;
    const maxAge = Math.max(0, Math.floor((entry.expiresAt - this.now()) / 1000));

    response.setHeader('Cache-Control', `private, max-age=${maxAge}`);
    response.setHeader('ETag', etag);
    response.setHeader('Content-Type', type);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    if (request.headers['if-none-match'] === etag) {
      response.status(304).end();
      return;
    }
    response.setHeader('Content-Length', String(body.length));
    response.status(200).end(request.method === 'HEAD' ? undefined : body);
  }

  /** Processed bytes of an upstream image: cache first, one fetch per URL at a time. */
  private load(url: string): Promise<Buffer | null> {
    const key = ImageStore.keyOf(url);
    const cached = this.store.get(key);
    if (cached) return Promise.resolve(cached);
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const task = this.fetchUpstream(url)
      .then((bytes) => {
        if (bytes) this.store.set(key, bytes);
        return bytes;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, task);
    return task;
  }

  private async fetchUpstream(url: string): Promise<Buffer | null> {
    if (!isProxyableImage(url)) return null;
    this.upstreamRequests += 1;
    try {
      const response = await this.fetcher(url, {
        redirect: 'error',
        headers: { 'User-Agent': USER_AGENT, Accept: 'image/jpeg,image/png' },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!response.ok || !response.body) return null;
      const declared = Number(response.headers.get('content-length') ?? '0');
      if (declared > MAX_UPSTREAM_BYTES) return null;
      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
        total += chunk.length;
        if (total > MAX_UPSTREAM_BYTES) return null;
        chunks.push(Buffer.from(chunk));
      }
      return stripMetadata(Buffer.concat(chunks))?.bytes ?? null;
    } catch {
      return null;
    }
  }
}
