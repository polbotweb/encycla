import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { loadConfig } from '../server/config';
import { migrate } from '../server/db/migrate';

const config = loadConfig();
const path = resolve(config.databasePath);
mkdirSync(dirname(path), { recursive: true });
const db = new Database(path);
db.pragma('journal_mode = WAL');
const applied = migrate(db);
console.info(`${applied} migration(s) applied to ${path}`);
db.close();
