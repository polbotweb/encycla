import type { Logger } from '../util/logger';
import type { TikTokAdapter, TikTokAdapterFactory, TikTokChatMessage } from './adapter';

export const BACKOFF_MIN_MS = 1_000;
export const BACKOFF_MAX_MS = 30_000;

/** 1 s, 2 s, 4 s … capped at 30 s. */
export function backoffDelay(attempt: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** Math.max(0, attempt));
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

  constructor(private readonly options: TikTokConnectorOptions) {
    this.scheduler = options.scheduler ?? realScheduler;
    this.target = options.target ?? null;
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
    void this.connect();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      this.scheduler.clearTimeout(this.timer);
      this.timer = null;
    }
    this.adapter?.disconnect();
    this.adapter = null;
    this.setConnected(false);
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
    let adapter: TikTokAdapter;
    try {
      adapter = this.options.factory(this.target);
    } catch (error) {
      this.options.logger.log('error', 'tiktok.adapter_unavailable', { reason: describe(error) });
      this.scheduleRetry();
      return;
    }
    this.adapter = adapter;
    adapter.onChat((message) => {
      if (this.adapter === adapter) {
        this.options.onChat(message);
      }
    });
    adapter.onDisconnect((reason) => {
      if (this.adapter !== adapter || !this.running) {
        return;
      }
      this.options.logger.log('warn', 'tiktok.disconnected', { reason });
      this.setConnected(false);
      this.scheduleRetry();
    });
    try {
      await adapter.connect();
    } catch (error) {
      if (this.adapter === adapter && this.running) {
        this.options.logger.log('warn', 'tiktok.connect_failed', { reason: describe(error) });
        this.scheduleRetry();
      }
      return;
    }
    if (this.adapter !== adapter || !this.running) {
      adapter.disconnect();
      return;
    }
    this.attempt = 0;
    this.options.logger.log('info', 'tiktok.connected');
    this.setConnected(true);
  }

  private scheduleRetry(): void {
    if (!this.running || this.timer !== null) {
      return;
    }
    this.adapter?.disconnect();
    this.adapter = null;
    const delay = backoffDelay(this.attempt);
    this.attempt += 1;
    this.timer = this.scheduler.setTimeout(() => void this.connect(), delay);
  }
}

/** Error text may echo request details: keep only a short, credential-free summary. */
function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(sessionid|session_id|cookie)[=:]\s*\S+/gi, '$1=[redacted]')
    .slice(0, 200);
}
