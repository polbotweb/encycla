import { generateOpaqueToken, hashToken, tokenHashesEqual } from './tokens';

export const OVERLAY_TOKEN_PREFIX = 'ovl_';
export const CONTROL_TOKEN_PREFIX = 'ctl_';

export type RoomRole = 'overlay' | 'control';

export interface IssuedRoomTokens {
  overlayToken: string;
  controlToken: string;
}

/**
 * Per-room overlay (read-only) and control tokens. Only hashes are kept; tokens live
 * until the room is closed and are revoked then (PROTOCOL 3.11).
 */
export class RoomTokenRegistry {
  private readonly hashes = new Map<string, { overlay: string; control: string }>();

  issue(roomCode: string): IssuedRoomTokens {
    const overlayToken = generateOpaqueToken(OVERLAY_TOKEN_PREFIX);
    const controlToken = generateOpaqueToken(CONTROL_TOKEN_PREFIX);
    this.hashes.set(roomCode, {
      overlay: hashToken(overlayToken),
      control: hashToken(controlToken),
    });
    return { overlayToken, controlToken };
  }

  verify(roomCode: string, role: RoomRole, token: unknown): boolean {
    const entry = this.hashes.get(roomCode);
    if (!entry || typeof token !== 'string') {
      return false;
    }
    const prefix = role === 'overlay' ? OVERLAY_TOKEN_PREFIX : CONTROL_TOKEN_PREFIX;
    if (!token.startsWith(prefix)) {
      return false;
    }
    return tokenHashesEqual(hashToken(token), role === 'overlay' ? entry.overlay : entry.control);
  }

  has(roomCode: string): boolean {
    return this.hashes.has(roomCode);
  }

  revoke(roomCode: string): void {
    this.hashes.delete(roomCode);
  }
}
