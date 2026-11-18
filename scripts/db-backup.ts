/**
 * One-off online backup (D-119): `pnpm db:backup`. Safe while the server runs (SQLite online
 * backup API over WAL). Writes to BACKUP_DIR (default data/backups) and applies BACKUP_KEEP.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { loadConfig } from '../server/config';
import { backupDatabase } from '../server/persistence/backup';

const config = loadConfig();
const path = resolve(config.databasePath);
const dir = config.backupDir ?? 'data/backups';
if (!existsSync(path)) {
  console.error(`No database at ${path}.`);
  process.exit(1);
}
const db = new Database(path, { fileMustExist: true });
db.pragma('busy_timeout = 5000');
try {
  const result = await backupDatabase(db, { dir, keep: config.backupKeep });
  console.info(`Backup written: ${result.path} (${result.bytes} bytes)`);
  for (const name of result.rotated) console.info(`Rotated out: ${name}`);
} finally {
  db.close();
}
