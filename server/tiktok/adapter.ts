export interface TikTokChatMessage {
  /** Stable TikTok handle; the identity key of a viewer. */
  uniqueId: string;
  nickname: string | null;
  comment: string;
}

/** Narrow port over the (unofficial) TikTok live chat client. */
export interface TikTokAdapter {
  /** Resolves once the chat is connected; rejects when the connection cannot be opened. */
  connect(): Promise<void>;
  disconnect(): void;
  onChat(handler: (message: TikTokChatMessage) => void): void;
  /** Called when an established connection drops. */
  onDisconnect(handler: (reason: string) => void): void;
}

export type TikTokAdapterFactory = () => TikTokAdapter;
