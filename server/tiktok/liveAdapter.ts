import type { TikTokAdapter, TikTokChatMessage } from './adapter';

const MODULE_NAME = 'tiktok-live-connector';

/** Minimal structural view of the parts of `tiktok-live-connector` v2 that Encycla uses. */
interface LiveConnection {
  on(event: string, handler: (...args: any[]) => void): unknown;
  connect(): Promise<unknown>;
  disconnect(): unknown;
}
type LiveConnectionCtor = new (
  uniqueId: string,
  options: Record<string, unknown>,
) => LiveConnection;

export interface LiveAdapterOptions {
  username: string;
  /** Raw cookie string, e.g. `sessionid=…; tt-target-idc=…`. Never logged. */
  sessionCookie: string;
}

export function parseSessionCookie(raw: string): { sessionId: string; ttTargetIdc: string } | null {
  const pairs = new Map<string, string>();
  for (const part of raw.split(';')) {
    const index = part.indexOf('=');
    if (index > 0) {
      pairs.set(part.slice(0, index).trim().toLowerCase(), part.slice(index + 1).trim());
    }
  }
  const sessionId = pairs.get('sessionid');
  if (!sessionId) {
    return null;
  }
  return { sessionId, ttTargetIdc: pairs.get('tt-target-idc') ?? '' };
}

/**
 * Adapter over the unofficial `tiktok-live-connector` package.
 *
 * The package is intentionally NOT a hard dependency: it is AGPL-3.0 licensed and relies on a
 * third-party signing service, so enabling it is an explicit operator decision
 * (`pnpm add tiktok-live-connector`, see docs/TIKTOK.md). When it is missing, `connect()` rejects
 * and the connector keeps retrying with backoff while the room stays in manual mode.
 */
export class LiveTikTokAdapter implements TikTokAdapter {
  private connection: LiveConnection | null = null;
  private chatHandler: (message: TikTokChatMessage) => void = () => {};
  private disconnectHandler: (reason: string) => void = () => {};

  constructor(private readonly options: LiveAdapterOptions) {}

  onChat(handler: (message: TikTokChatMessage) => void): void {
    this.chatHandler = handler;
  }

  onDisconnect(handler: (reason: string) => void): void {
    this.disconnectHandler = handler;
  }

  async connect(): Promise<void> {
    const session = parseSessionCookie(this.options.sessionCookie);
    if (!session) {
      throw new Error('TIKTOK_SESSION_COOKIE does not contain a sessionid');
    }
    let ctor: LiveConnectionCtor;
    try {
      const loaded = (await import(/* @vite-ignore */ MODULE_NAME)) as {
        TikTokLiveConnection?: LiveConnectionCtor;
      };
      if (!loaded.TikTokLiveConnection) {
        throw new Error('unexpected module shape');
      }
      ctor = loaded.TikTokLiveConnection;
    } catch {
      throw new Error(`${MODULE_NAME} is not installed or could not be loaded`);
    }

    const connection = new ctor(this.options.username, {
      session: { cookie: { type: 'cookie', value: session } },
      authenticateWs: true,
    });
    connection.on('chat', (data: any) => {
      const uniqueId = data?.user?.uniqueId ?? data?.uniqueId;
      const comment = data?.comment;
      if (typeof uniqueId !== 'string' || typeof comment !== 'string') {
        return;
      }
      const nickname = data?.user?.nickname ?? data?.nickname;
      this.chatHandler({
        uniqueId,
        nickname: typeof nickname === 'string' ? nickname : null,
        comment,
      });
    });
    connection.on('disconnected', () => this.disconnectHandler('disconnected'));
    connection.on('streamEnd', () => this.disconnectHandler('stream ended'));
    // Library errors may embed request details; they are deliberately not forwarded.
    connection.on('error', () => {});
    this.connection = connection;
    await connection.connect();
  }

  disconnect(): void {
    try {
      this.connection?.disconnect();
    } catch {
      /* already closed */
    }
    this.connection = null;
  }
}
