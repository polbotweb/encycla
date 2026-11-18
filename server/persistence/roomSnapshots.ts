import type Database from 'better-sqlite3';
import type { GameState } from '../game/types';

export interface RoomSnapshot {
  roomCode: string;
  stateJson: string;
  savedAt: number;
}

/** Running rooms kept across a restart (D-117). */
export interface RoomSnapshotRepository {
  save(roomCode: string, stateJson: string, savedAt: number): void;
  delete(roomCode: string): void;
  list(): RoomSnapshot[];
}

/** A snapshot older than this is not restored (players have long given up). */
export const RESTORE_MAX_AGE_MS = 10 * 60 * 1000;

const TERMINAL = new Set(['MATCH_OVER', 'CLOSED']);

/**
 * Whether a room can come back after a restart: recent, not finished, and not a TikTok room
 * (the chat connection, the overlay and control links are not kept).
 */
export function isRestorable(state: GameState): boolean {
  return !state.isTikTok && !TERMINAL.has(state.phase) && state.closedReason === null;
}

export function restorableSnapshots(
  snapshots: readonly RoomSnapshot[],
  now: number,
): { state: GameState; savedAt: number }[] {
  const result: { state: GameState; savedAt: number }[] = [];
  for (const snapshot of snapshots) {
    if (now - snapshot.savedAt > RESTORE_MAX_AGE_MS || snapshot.savedAt > now + 60_000) continue;
    try {
      const state = JSON.parse(snapshot.stateJson) as GameState;
      if (state.roomCode === snapshot.roomCode && isRestorable(state)) {
        result.push({ state, savedAt: snapshot.savedAt });
      }
    } catch {
      /* corrupted snapshot: dropped */
    }
  }
  return result;
}

export class SqliteRoomSnapshotRepository implements RoomSnapshotRepository {
  private readonly upsert;
  private readonly remove;
  private readonly all;

  constructor(db: Database.Database) {
    this.upsert = db.prepare(
      `INSERT INTO active_rooms (room_code, state_json, saved_at) VALUES (?, ?, ?)
       ON CONFLICT(room_code) DO UPDATE SET state_json = excluded.state_json, saved_at = excluded.saved_at`,
    );
    this.remove = db.prepare('DELETE FROM active_rooms WHERE room_code = ?');
    this.all = db.prepare('SELECT room_code, state_json, saved_at FROM active_rooms');
  }

  save(roomCode: string, stateJson: string, savedAt: number): void {
    this.upsert.run(roomCode, stateJson, savedAt);
  }

  delete(roomCode: string): void {
    this.remove.run(roomCode);
  }

  list(): RoomSnapshot[] {
    return (this.all.all() as { room_code: string; state_json: string; saved_at: number }[]).map(
      (row) => ({ roomCode: row.room_code, stateJson: row.state_json, savedAt: row.saved_at }),
    );
  }
}

export class MemoryRoomSnapshotRepository implements RoomSnapshotRepository {
  private readonly rows = new Map<string, RoomSnapshot>();

  save(roomCode: string, stateJson: string, savedAt: number): void {
    this.rows.set(roomCode, { roomCode, stateJson, savedAt });
  }

  delete(roomCode: string): void {
    this.rows.delete(roomCode);
  }

  list(): RoomSnapshot[] {
    return [...this.rows.values()];
  }
}
