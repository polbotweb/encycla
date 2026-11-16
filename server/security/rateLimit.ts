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
