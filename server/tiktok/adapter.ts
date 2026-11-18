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

/** Builds an adapter for the live of `target` (a TikTok handle without "@"). */
export type TikTokAdapterFactory = (target: string) => TikTokAdapter;

/** TikTok handle: letters, digits, "." and "_", 2-24 characters, without the leading "@". */
export const TIKTOK_HANDLE = /^[A-Za-z0-9._]{2,24}$/;

export function normalizeHandle(raw: string): string | null {
  const handle = raw.trim().replace(/^@/, '');
  return TIKTOK_HANDLE.test(handle) ? handle.toLowerCase() : null;
}
