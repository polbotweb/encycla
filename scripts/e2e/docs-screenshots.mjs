/* global process */
// `pnpm docs:screenshots`: fresh database, then the Playwright "screenshots" project on its own
// servers (ports 3110/3111). Images go through the /img proxy and stay in data/image-cache.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

for (const base of ['data/screenshots', 'data/screenshots-tiktok']) {
  for (const suffix of ['.db', '.db-shm', '.db-wal']) rmSync(`${base}${suffix}`, { force: true });
}
const result = spawnSync('pnpm', ['exec', 'playwright', 'test', '--project=screenshots'], {
  stdio: 'inherit',
  env: { ...process.env, DOCS_SCREENSHOTS: '1' },
});
process.exit(result.status ?? 1);
