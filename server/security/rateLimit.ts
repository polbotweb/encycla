import type { NextFunction, Request, Response } from 'express';
import { sendError } from '../http/errors';

/** Fixed-window counter keyed by an arbitrary string (IP, session, socket). In memory (v1 debt). */
export class FixedWindowLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns true when the hit is allowed. */
  hit(key: string): boolean {
    const now = this.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      this.prune(now);
      return true;
    }
    bucket.count += 1;
    return bucket.count <= this.limit;
  }

  reset(): void {
    this.buckets.clear();
  }

  private prune(now: number): void {
    if (this.buckets.size < 5000) {
      return;
    }
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}

/** Token bucket for per-socket event flow: sustained rate with a burst allowance. */
export class TokenBucket {
  private tokens: number;
  private updatedAt: number;

  constructor(
    private readonly ratePerSecond: number,
    private readonly burst: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = burst;
    this.updatedAt = now();
  }

  take(): boolean {
    const now = this.now();
    const elapsed = Math.max(0, now - this.updatedAt) / 1000;
    this.updatedAt = now;
    this.tokens = Math.min(this.burst, this.tokens + elapsed * this.ratePerSecond);
    if (this.tokens < 1) {
      return false;
    }
    this.tokens -= 1;
    return true;
  }
}

/**
 * `/api` limiter (D-118): requests with a valid session count against that session, plus a high
 * per-IP ceiling; anonymous requests count against their IP. A forged bearer token is not a
 * session, so it falls into the anonymous bucket.
 */
export function apiRateLimit(options: {
  now: () => number;
  sessionOf: (request: Request) => string | null;
  anonymousPerIp: number;
  perSession: number;
  perIpCeiling: number;
  exempt?: (request: Request) => boolean;
}) {
  const anonymous = new FixedWindowLimiter(options.anonymousPerIp, 60_000, options.now);
  const sessions = new FixedWindowLimiter(options.perSession, 60_000, options.now);
  const ceiling = new FixedWindowLimiter(options.perIpCeiling, 60_000, options.now);
  return (request: Request, response: Response, next: NextFunction): void => {
    if (options.exempt?.(request)) {
      next();
      return;
    }
    const ip = clientIp(request);
    const session = options.sessionOf(request);
    const allowed = session
      ? sessions.hit(`s:${session}`) && ceiling.hit(ip)
      : anonymous.hit(ip) && ceiling.hit(ip);
    if (allowed) {
      next();
      return;
    }
    response.setHeader('Retry-After', '60');
    sendError(response, 429, 'RATE_LIMITED', 'Too many requests.');
  };
}

/**
 * Client address of a raw request (Socket.io handshake) with the same rule as Express
 * `trust proxy = <hops>`: walk `X-Forwarded-For` from the right, trusting `hops` proxies.
 */
export function forwardedIp(
  remote: string | undefined,
  forwardedFor: string | string[] | undefined,
  hops: false | number,
): string {
  const socketAddress = remote ?? 'unknown';
  if (!hops || hops <= 0 || !forwardedFor) return socketAddress;
  const header = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor;
  const chain = [
    socketAddress,
    ...header
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .reverse(),
  ];
  return chain[Math.min(hops, chain.length - 1)] ?? socketAddress;
}

export function clientIp(request: Request): string {
  return request.ip ?? request.socket.remoteAddress ?? 'unknown';
}

export function httpRateLimit(
  limiter: FixedWindowLimiter,
  keyOf: (request: Request, response: Response) => string = clientIp,
) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (limiter.hit(keyOf(request, response))) {
      next();
      return;
    }
    response.setHeader('Retry-After', '60');
    sendError(response, 429, 'RATE_LIMITED', 'Too many requests.');
  };
}
