import type { Logger } from '../util/logger';
import type { TikTokAdapter, TikTokAdapterFactory, TikTokChatMessage } from './adapter';

export const BACKOFF_MIN_MS = 1_000;
export const BACKOFF_MAX_MS = 30_000;

/** The live is not on air (stream ended, user offline): retry slowly, it may take hours. */
export const OFFLINE_BACKOFF_MIN_MS = 15_000;
export const OFFLINE_BACKOFF_MAX_MS = 120_000;
/** A connection attempt that neither succeeds nor fails within this time is abandoned. */
export const CONNECT_TIMEOUT_MS = 20_000;
/** Each delay is spread by ±20 % so restarts do not hammer the signing service together. */
export const BACKOFF_JITTER = 0.2;

/** 1 s, 2 s, 4 s … capped at 30 s (offline live: 15 s, 30 s … capped at 2 min). */
export function backoffDelay(attempt: number, offline = false): number {
  const min = offline ? OFFLINE_BACKOFF_MIN_MS : BACKOFF_MIN_MS;
  const max = offline ? OFFLINE_BACKOFF_MAX_MS : BACKOFF_MAX_MS;
  return Math.min(max, min * 2 ** Math.max(0, attempt));
}

/** Errors and disconnect reasons that mean "this live is not on air right now". */
const OFFLINE = /offline|not live|stream ?end|live ?not ?found|user_?not_?found|no live/i;

export function isOfflineReason(reason: string): boolean {
  return OFFLINE.test(reason);
}

export type ConnectorState = 'idle' | 'connecting' | 'connected' | 'retrying';

/** What the streamer console shows about the chat connection (never a credential). */
export interface ConnectorStatus {
  state: ConnectorState;
  target: string | null;
  /** Failed attempts since the last successful connection. */
  attempts: number;
  /** Short, redacted reason of the last failure or drop. */
  lastError: string | null;
  /** The live looked offline at the last failure (slow retries). */
  offline: boolean;
  lastConnectedAt: number | null;
  lastMessageAt: number | null;
  nextRetryAt: number | null;
}

export interface Scheduler {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const realScheduler: Scheduler = {
  setTimeout: (callback, ms) => {
    const handle = setTimeout(callback, ms);
    handle.unref();
    return handle;
  },
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

export interface TikTokConnectorOptions {
  factory: TikTokAdapterFactory;
  logger: Logger;
  onChat: (message: TikTokChatMessage) => void;
  onConnectionChange: (connected: boolean) => void;
  scheduler?: Scheduler;
  /** Live followed at startup (`TIKTOK_USERNAME`); null waits for a room to name one. */
  target?: string | null;
  /** 0–1 random source for the jitter (tests pass a constant). */
  random?: () => number;
  now?: () => number;
  connectTimeoutMs?: number;
}

/** Keeps one chat connection alive with exponential backoff. Never logs credentials. */
export class TikTokConnector {
  private adapter: TikTokAdapter | null = null;
  private timer: unknown = null;
  private attempt = 0;
  private running = false;
  private connected = false;
  private readonly scheduler: Scheduler;
  private target: string | null;
  private state: ConnectorState = 'idle';
  private lastError: string | null = null;
  private offline = false;
  private lastConnectedAt: number | null = null;
  private lastMessageAt: number | null = null;
  private nextRetryAt: number | null = null;
  private connectTimer: unknown = null;
  private readonly random: () => number;
  private readonly now: () => number;

  constructor(private readonly options: TikTokConnectorOptions) {
    this.scheduler = options.scheduler ?? realScheduler;
    this.target = options.target ?? null;
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
  }

  status(): ConnectorStatus {
    return {
      state: this.state,
      target: this.target,
      attempts: this.attempt,
      lastError: this.lastError,
      offline: this.offline,
      lastConnectedAt: this.lastConnectedAt,
      lastMessageAt: this.lastMessageAt,
      nextRetryAt: this.state === 'retrying' ? this.nextRetryAt : null,
    };
  }

  /** The live currently followed (a TikTok handle), if any. */
  currentTarget(): string | null {
    return this.target;
  }

  /** Follows another live: drops the current connection and reconnects to `target`. */
  retarget(target: string): void {
    if (target === this.target) return;
    this.target = target;
    if (this.running) {
      this.stop();
      this.start();
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  start(): void {
    if (this.running || this.target === null) {
      return;
    }
    this.running = true;
    this.attempt = 0;
    this.offline = false;
    this.lastError = null;
    void this.connect();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      this.scheduler.clearTimeout(this.timer);
      this.timer = null;
    }
    this.clearConnectTimer();
    this.adapter?.disconnect();
    this.adapter = null;
    this.state = 'idle';
    this.nextRetryAt = null;
    this.setConnected(false);
  }

  private clearConnectTimer(): void {
    if (this.connectTimer !== null) {
      this.scheduler.clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  private fail(event: string, reason: string, level: 'warn' | 'error' = 'warn'): void {
    const summary = describe(reason);
    this.lastError = summary;
    this.offline = isOfflineReason(summary);
    this.options.logger.log(level, event, { reason: summary, offline: this.offline });
  }

  private setConnected(connected: boolean): void {
    if (this.connected !== connected) {
      this.connected = connected;
      this.options.onConnectionChange(connected);
    }
  }

  private async connect(): Promise<void> {
    if (!this.running || this.target === null) {
      return;
    }
    this.timer = null;
    this.nextRetryAt = null;
    this.state = 'connecting';
    let adapter: TikTokAdapter;
    try {
      adapter = this.options.factory(this.target);
    } catch (error) {
      this.fail('tiktok.adapter_unavailable', describe(error), 'error');
      this.scheduleRetry();
      return;
    }
    this.adapter = adapter;
    adapter.onChat((message) => {
      if (this.adapter === adapter) {
        this.lastMessageAt = this.now();
        this.options.onChat(message);
      }
    });
    adapter.onDisconnect((reason) => {
      if (this.adapter !== adapter || !this.running) {
        return;
      }
      this.fail('tiktok.disconnected', reason);
      this.setConnected(false);
      this.scheduleRetry();
    });
    adapter.onError?.((kind) => {
      if (this.adapter === adapter) {
        this.options.logger.log('warn', 'tiktok.library_error', { kind: describe(kind) });
      }
    });
    // A connection that hangs (signing service down, half-open socket) is abandoned.
    let timedOut = false;
    this.clearConnectTimer();
    this.connectTimer = this.scheduler.setTimeout(() => {
      this.connectTimer = null;
      if (this.adapter !== adapter || !this.running || this.connected) return;
      timedOut = true;
      this.fail('tiktok.connect_timeout', 'connection timed out');
      this.scheduleRetry();
    }, this.options.connectTimeoutMs ?? CONNECT_TIMEOUT_MS);
    try {
      await adapter.connect();
    } catch (error) {
      this.clearConnectTimer();
      if (this.adapter === adapter && this.running && !timedOut) {
        this.fail('tiktok.connect_failed', describe(error));
        this.scheduleRetry();
      }
      return;
    }
    this.clearConnectTimer();
    if (this.adapter !== adapter || !this.running || timedOut) {
      adapter.disconnect();
      return;
    }
    this.attempt = 0;
    this.offline = false;
    this.lastError = null;
    this.state = 'connected';
    this.lastConnectedAt = this.now();
    this.options.logger.log('info', 'tiktok.connected');
    this.setConnected(true);
  }

  private scheduleRetry(): void {
    if (!this.running || this.timer !== null) {
      return;
    }
    this.clearConnectTimer();
    this.adapter?.disconnect();
    this.adapter = null;
    const base = backoffDelay(this.attempt, this.offline);
    const delay = Math.round(base * (1 - BACKOFF_JITTER + 2 * BACKOFF_JITTER * this.random()));
    this.attempt += 1;
    this.state = 'retrying';
    this.nextRetryAt = this.now() + delay;
    this.timer = this.scheduler.setTimeout(() => void this.connect(), delay);
  }
}

/** Error text may echo request details: keep only a short, credential-free summary. */
export function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(
      /(sessionid|session_id|cookie|sid_tt|sid_guard|tt-target-idc|signApiKey|apiKey)[=:]\s*[^\s;,]+/gi,
      '$1=[redacted]',
    )
    .replace(/https?:\/\/\S+/g, '[url]')
    .slice(0, 200);
}
