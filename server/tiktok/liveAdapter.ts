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
  /** Optional Euler Stream signing key (`TIKTOK_SIGN_API_KEY`). Secret, never logged. */
  signApiKey?: string | null;
}

/** Loads the optional connector package; injectable so tests never touch the network. */
export type ConnectorModuleLoader = () => Promise<unknown>;

const loadConnectorModule: ConnectorModuleLoader = () => import(/* @vite-ignore */ MODULE_NAME);

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

/** Whether the optional connector package can be loaded (checked at startup when TikTok is on). */
export async function isConnectorInstalled(
  loadModule: ConnectorModuleLoader = loadConnectorModule,
): Promise<boolean> {
  try {
    const loaded = (await loadModule()) as { TikTokLiveConnection?: unknown };
    return typeof loaded.TikTokLiveConnection === 'function';
  } catch {
    return false;
  }
}

/**
 * Adapter over the unofficial `tiktok-live-connector` package (v2).
 *
 * The package is an **optional** dependency, isolated behind the `TikTokAdapter` port: it is
 * AGPL-3.0-only and relies on a third-party signing service (Euler Stream). This file is the only
 * place that loads it, lazily, with a dynamic import, and only when `TIKTOK_ENABLED=true`; no type
 * or value of the package leaks into the rest of the code. When it is not installed
 * (`pnpm install --no-optional`, or the Docker image built without `WITH_TIKTOK=true`), `connect()`
 * rejects and the connector keeps retrying with backoff while the room stays in manual mode.
 * See docs/TIKTOK.md and docs/LICENSES.md.
 */
export class LiveTikTokAdapter implements TikTokAdapter {
  private connection: LiveConnection | null = null;
  private chatHandler: (message: TikTokChatMessage) => void = () => {};
  private disconnectHandler: (reason: string) => void = () => {};

  constructor(
    private readonly options: LiveAdapterOptions,
    private readonly loadModule: ConnectorModuleLoader = loadConnectorModule,
  ) {}

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
      const loaded = (await this.loadModule()) as {
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
      ...(this.options.signApiKey ? { signApiKey: this.options.signApiKey } : {}),
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
