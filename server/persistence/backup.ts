/**
 * Online SQLite backups (D-119).
 *
 * `better-sqlite3`'s `backup()` uses SQLite's online backup API: it copies a consistent snapshot
 * page by page while the server keeps reading and writing (WAL). Each copy is written to a
 * temporary name, checked with `PRAGMA quick_check`, then renamed, so a listed backup is always
 * complete. Rotation keeps the newest `keep` files.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import Database from 'better-sqlite3';

export const BACKUP_PREFIX = 'encycla-';
const BACKUP_PATTERN = /^encycla-\d{8}T\d{6}(?:\d{3})?Z\.db$/;

export interface BackupFile {
  path: string;
  name: string;
  bytes: number;
  createdAt: number;
}

/** `encycla-20261118T183000123Z.db` (UTC, sortable). */
export function backupName(now: number): string {
  const stamp = new Date(now).toISOString().replace(/[-:]/g, '').replace('.', '');
  return `${BACKUP_PREFIX}${stamp}.db`;
}

export function listBackups(dir: string): BackupFile[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => BACKUP_PATTERN.test(name))
    .sort()
    .map((name) => {
      const path = join(dir, name);
      const stat = statSync(path);
      return { path, name, bytes: stat.size, createdAt: stat.mtimeMs };
    });
}

/** Integrity of a database file, opened read-only: quick_check plus the migrations table. */
export function verifyDatabaseFile(path: string): { ok: boolean; reason: string | null } {
  let db: Database.Database | null = null;
  try {
    db = new Database(path, { readonly: true, fileMustExist: true });
    if (db.pragma('quick_check', { simple: true }) !== 'ok') {
      return { ok: false, reason: 'PRAGMA quick_check failed' };
    }
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
      .get();
    return table ? { ok: true, reason: null } : { ok: false, reason: 'not an Encycla database' };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  } finally {
    db?.close();
  }
}

function removeWithSidecars(path: string): void {
  for (const suffix of ['', '-wal', '-shm', '-journal'])
    rmSync(`${path}${suffix}`, { force: true });
}

/** Deletes the oldest backups beyond `keep`; returns the deleted names. */
export function rotateBackups(dir: string, keep: number): string[] {
  const files = listBackups(dir);
  const excess = files.slice(0, Math.max(0, files.length - Math.max(1, keep)));
  for (const file of excess) removeWithSidecars(file.path);
  return excess.map((file) => file.name);
}

export interface BackupResult {
  path: string;
  bytes: number;
  rotated: string[];
}

export async function backupDatabase(
  db: Database.Database,
  options: { dir: string; keep: number; now?: number },
): Promise<BackupResult> {
  const dir = resolve(options.dir);
  mkdirSync(dir, { recursive: true });
  const target = join(dir, backupName(options.now ?? Date.now()));
  const temporary = `${target}.partial`;
  try {
    await db.backup(temporary);
    // A standalone copy: rollback journal, no -wal/-shm files next to it. The server switches
    // back to WAL when it opens a restored file.
    const copy = new Database(temporary);
    try {
      copy.pragma('journal_mode = DELETE');
    } finally {
      copy.close();
    }
    const check = verifyDatabaseFile(temporary);
    if (!check.ok) throw new Error(`backup failed verification: ${check.reason}`);
    renameSync(temporary, target);
  } finally {
    removeWithSidecars(temporary);
  }
  return {
    path: target,
    bytes: statSync(target).size,
    rotated: rotateBackups(dir, options.keep),
  };
}

export interface RestoreResult {
  restored: string;
  databasePath: string;
  /** Copy of the database that was replaced, or null when there was none. */
  previous: string | null;
}

/**
 * Replaces the database file with a verified backup. The server must be stopped: the copy is not
 * coordinated with a live connection. The current database (and its WAL) is kept aside first.
 */
export function restoreDatabase(
  backupPath: string,
  databasePath: string,
  now: number = Date.now(),
): RestoreResult {
  const source = resolve(backupPath);
  const target = resolve(databasePath);
  const check = verifyDatabaseFile(source);
  if (!check.ok) throw new Error(`refusing to restore ${basename(source)}: ${check.reason}`);

  mkdirSync(dirname(target), { recursive: true });
  let previous: string | null = null;
  if (existsSync(target)) {
    // Fold the WAL into the main file so the aside copy is complete on its own.
    const current = new Database(target);
    try {
      current.pragma('wal_checkpoint(TRUNCATE)');
    } finally {
      current.close();
    }
    previous = `${target}.before-restore-${backupName(now).slice(BACKUP_PREFIX.length, -3)}`;
    copyFileSync(target, previous);
  }
  for (const suffix of ['-wal', '-shm']) rmSync(`${target}${suffix}`, { force: true });
  const temporary = `${target}.restoring`;
  copyFileSync(source, temporary);
  renameSync(temporary, target);
  return { restored: source, databasePath: target, previous };
}

export interface BackupSchedulerOptions {
  db: Database.Database;
  dir: string;
  keep: number;
  intervalMs: number;
  onResult?: (result: BackupResult) => void;
  onError?: (error: unknown) => void;
}

/** Periodic backups; the first one runs one interval after start. Timers do not hold the process. */
export function startBackupScheduler(options: BackupSchedulerOptions): { stop(): void } {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    backupDatabase(options.db, { dir: options.dir, keep: options.keep })
      .then((result) => options.onResult?.(result))
      .catch((error: unknown) => options.onError?.(error))
      .finally(() => {
        running = false;
      });
  }, options.intervalMs);
  timer.unref();
  return { stop: () => clearInterval(timer) };
}
