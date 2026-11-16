import { useEffect, useState } from 'react';
import type { PublicRoomState } from '../../shared/types';

/**
 * Remaining time of the current phase, for display only. The server decides when a phase ends;
 * the client merely renders `phaseEndsAt - (now + clockOffset)`.
 */
export function remainingMs(room: PublicRoomState | null, clockOffset: number, now = Date.now()): number | null {
  if (!room) return null;
  if (room.phase === 'PAUSED') return room.remainingMs;
  if (room.phaseEndsAt === null) return null;
  return Math.max(0, room.phaseEndsAt - (now + clockOffset));
}

export function useRemaining(room: PublicRoomState | null, clockOffset: number, intervalMs = 200): number | null {
  const [value, setValue] = useState<number | null>(() => remainingMs(room, clockOffset));
  useEffect(() => {
    setValue(remainingMs(room, clockOffset));
    if (!room || room.phase === 'PAUSED' || room.phaseEndsAt === null) {
      return undefined;
    }
    const timer = setInterval(() => setValue(remainingMs(room, clockOffset)), intervalMs);
    return () => clearInterval(timer);
  }, [room, clockOffset, intervalMs]);
  return value;
}
