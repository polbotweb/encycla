import { existsSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  backupDatabase,
  backupName,
  listBackups,
  restoreDatabase,
  rotateBackups,
  startBackupScheduler,
  verifyDatabaseFile,
} from '../../server/persistence/backup';
import { initializePersistence } from '../../server/persistence/db';
import type { NewPlayer } from '../../server/persistence/repositories';

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'encycla-backup-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  vi.useRealTimers();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function player(id: string, pseudo: string): NewPlayer {
  return {
    id,
    provider: 'web',
    externalId: null,
    pseudo,
    pseudoNormalized: pseudo.toLowerCase(),
    avatar: 'owl',
    createdAt: 1_000,
    updatedAt: 1_000,
  };
}

function liveDatabase(dir: string) {
  const databasePath = join(dir, 'encycla.db');
  const initialized = initializePersistence({ databasePath, now: 1_000 });
  const db = initialized.database!;
  initialized.persistence.players.create(player('p1', 'Ada'));
  return { databasePath, db, persistence: initialized.persistence };
}

function playerCount(path: string): number {
  const db = new Database(path, { readonly: true });
  try {
    return (db.prepare('SELECT COUNT(*) AS n FROM players').get() as { n: number }).n;
  } finally {
    db.close();
  }
}

describe('online SQLite backups (D-119)', () => {
  it('names backups by sortable UTC time', () => {
    expect(backupName(Date.UTC(2026, 10, 18, 18, 30, 0, 123))).toBe(
      'encycla-20261118T183000123Z.db',
    );
  });

  it('copies the live WAL database consistently while it stays open', async () => {
    const dir = tempDir();
    const { db, persistence } = liveDatabase(dir);
    const result = await backupDatabase(db, { dir: join(dir, 'backups'), keep: 5, now: 5_000 });
    expect(result.path.endsWith(backupName(5_000))).toBe(true);
    expect(result.bytes).toBeGreaterThan(0);
    expect(verifyDatabaseFile(result.path)).toEqual({ ok: true, reason: null });
    expect(playerCount(result.path)).toBe(1);
    expect(readdirSync(join(dir, 'backups')).some((name) => name.endsWith('.partial'))).toBe(false);
    persistence.close();
  });

  it('rotates to the newest N backups', async () => {
    const dir = tempDir();
    const { db, persistence } = liveDatabase(dir);
    const target = join(dir, 'backups');
    for (let index = 0; index < 4; index += 1) {
      await backupDatabase(db, { dir: target, keep: 2, now: 10_000 + index * 1_000 });
    }
    expect(listBackups(target).map((file) => file.name)).toEqual([
      backupName(12_000),
      backupName(13_000),
    ]);
    writeFileSync(join(target, 'notes.txt'), 'kept');
    expect(rotateBackups(target, 1)).toEqual([backupName(12_000)]);
    expect(existsSync(join(target, 'notes.txt'))).toBe(true);
    persistence.close();
  });

  it('refuses to verify or restore a file that is not an Encycla database', () => {
    const dir = tempDir();
    const junk = join(dir, 'junk.db');
    writeFileSync(junk, 'not sqlite');
    expect(verifyDatabaseFile(junk).ok).toBe(false);
    const empty = join(dir, 'empty.db');
    new Database(empty).close();
    expect(verifyDatabaseFile(empty)).toEqual({ ok: false, reason: 'not an Encycla database' });
    expect(verifyDatabaseFile(join(dir, 'missing.db')).ok).toBe(false);
    expect(() => restoreDatabase(junk, join(dir, 'encycla.db'))).toThrow(/refusing to restore/);
  });

  it('restores a backup over a stopped database and keeps the previous one aside', async () => {
    const dir = tempDir();
    const { databasePath, db, persistence } = liveDatabase(dir);
    const backup = await backupDatabase(db, { dir: join(dir, 'backups'), keep: 3, now: 20_000 });
    persistence.players.create(player('p2', 'Grace'));
    persistence.close();
    expect(playerCount(databasePath)).toBe(2);

    const result = restoreDatabase(backup.path, databasePath, 30_000);
    expect(existsSync(`${databasePath}-wal`)).toBe(false);
    expect(playerCount(databasePath)).toBe(1);
    expect(result.previous).not.toBeNull();
    expect(playerCount(result.previous!)).toBe(2);

    const fresh = join(dir, 'new', 'encycla.db');
    expect(restoreDatabase(backup.path, fresh).previous).toBeNull();
    expect(playerCount(fresh)).toBe(1);
  });

  it('lists nothing for a missing directory', () => {
    expect(listBackups(join(tempDir(), 'none'))).toEqual([]);
  });

  it('schedules backups and reports results and failures', async () => {
    vi.useFakeTimers();
    const dir = tempDir();
    const { db, persistence } = liveDatabase(dir);
    const results: string[] = [];
    const errors: unknown[] = [];
    const scheduler = startBackupScheduler({
      db,
      dir: join(dir, 'backups'),
      keep: 3,
      intervalMs: 1_000,
      onResult: (result) => results.push(result.path),
      onError: (error) => errors.push(error),
    });
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(results).toHaveLength(1));
    scheduler.stop();
    persistence.close();

    const broken = startBackupScheduler({
      db,
      dir: join(dir, 'backups'),
      keep: 3,
      intervalMs: 1_000,
      onError: (error) => errors.push(error),
    });
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(errors).toHaveLength(1));
    broken.stop();
  });

  it('keeps file times for listing', async () => {
    const dir = tempDir();
    const { db, persistence } = liveDatabase(dir);
    const backup = await backupDatabase(db, { dir: join(dir, 'b'), keep: 3, now: 40_000 });
    utimesSync(backup.path, 50, 50);
    expect(listBackups(join(dir, 'b'))[0]!.createdAt).toBe(50_000);
    persistence.close();
  });
});
