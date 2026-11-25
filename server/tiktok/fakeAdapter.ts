import type { TikTokAdapter, TikTokChatMessage } from './adapter';

/** Deterministic adapter for tests and local development without a live. */
export class FakeTikTokAdapter implements TikTokAdapter {
  connected = false;
  connectCalls = 0;
  failNextConnects = 0;
  /** The next connect() never settles (a hung connection). */
  hangNextConnect = false;
  /** Message thrown by failing connects. */
  failMessage = 'fake connect failure';
  private errorHandler: (kind: string) => void = () => {};
  private chatHandler: (message: TikTokChatMessage) => void = () => {};
  private disconnectHandler: (reason: string) => void = () => {};

  async connect(): Promise<void> {
    this.connectCalls += 1;
    if (this.hangNextConnect) {
      this.hangNextConnect = false;
      return new Promise<void>(() => {});
    }
    if (this.failNextConnects > 0) {
      this.failNextConnects -= 1;
      throw new Error(this.failMessage);
    }
    this.connected = true;
  }

  disconnect(): void {
    this.connected = false;
  }

  onChat(handler: (message: TikTokChatMessage) => void): void {
    this.chatHandler = handler;
  }

  onDisconnect(handler: (reason: string) => void): void {
    this.disconnectHandler = handler;
  }

  onError(handler: (kind: string) => void): void {
    this.errorHandler = handler;
  }

  // ---- test controls ----

  say(uniqueId: string, comment: string, nickname: string | null = null, id?: string): void {
    this.chatHandler({ uniqueId, nickname, comment, ...(id ? { id } : {}) });
  }

  error(kind: string): void {
    this.errorHandler(kind);
  }

  drop(reason = 'fake drop'): void {
    this.connected = false;
    this.disconnectHandler(reason);
  }
}
