import type { TikTokAdapter, TikTokChatMessage } from './adapter';

/** Deterministic adapter for tests and local development without a live. */
export class FakeTikTokAdapter implements TikTokAdapter {
  connected = false;
  connectCalls = 0;
  failNextConnects = 0;
  private chatHandler: (message: TikTokChatMessage) => void = () => {};
  private disconnectHandler: (reason: string) => void = () => {};

  async connect(): Promise<void> {
    this.connectCalls += 1;
    if (this.failNextConnects > 0) {
      this.failNextConnects -= 1;
      throw new Error('fake connect failure');
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

  // ---- test controls ----

  say(uniqueId: string, comment: string, nickname: string | null = null): void {
    this.chatHandler({ uniqueId, nickname, comment });
  }

  drop(reason = 'fake drop'): void {
    this.connected = false;
    this.disconnectHandler(reason);
  }
}
