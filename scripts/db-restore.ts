/**
 * Restore a backup (D-119): `pnpm db:restore [<file> | latest] --yes`.
 *
 * Stop the server first. The backup is verified (quick_check, Encycla schema), the current
 * database is kept aside as `<db>.before-restore-<time>`, its WAL/SHM files are removed, then the
 * backup replaces it. Without arguments: lists the available backups.
 */
import { resolve } from 'node:path';
import { loadConfig } from '../server/config';
import { listBackups, restoreDatabase } from '../server/persistence/backup';

const config = loadConfig();
const dir = resolve(config.backupDir ?? 'data/backups');
const args = process.argv.slice(2);
const confirmed = args.includes('--yes');
const choice = args.find((arg) => !arg.startsWith('--'));
const backups = listBackups(dir);

if (!choice) {
  if (backups.length === 0) {
    console.info(`No backup in ${dir}.`);
  } else {
    console.info(`Backups in ${dir} (oldest first):`);
    for (const file of backups) {
      console.info(`  ${file.name}  ${(file.bytes / 1024).toFixed(0)} KiB`);
    }
    console.info('Restore with: pnpm db:restore <name | latest> --yes (server stopped).');
  }
  process.exit(0);
}

const source =
  choice === 'latest'
    ? backups.at(-1)?.path
    : (backups.find((file) => file.name === choice)?.path ?? resolve(choice));
if (!source) {
  console.error(`No backup in ${dir}.`);
  process.exit(1);
}
const target = resolve(config.databasePath);
if (!confirmed) {
  console.info(`Would restore ${source}\n  over ${target}\nStop the server, then add --yes.`);
  process.exit(0);
}
try {
  const result = restoreDatabase(source, target);
  console.info(`Restored ${result.restored} -> ${result.databasePath}`);
  if (result.previous) console.info(`Previous database kept at ${result.previous}`);
  console.info('Start the server: pending migrations apply at startup.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
