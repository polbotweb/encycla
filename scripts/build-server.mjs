// Bundles the server (and its CLI entry points) for `node dist/server/index.js`.
// The sources use extensionless imports, so plain `tsc` output would not run under Node ESM.
import { cp, rm } from 'node:fs/promises';
import { build } from 'esbuild';

await rm('dist/server', { recursive: true, force: true });
await rm('dist/scripts', { recursive: true, force: true });

await build({
  entryPoints: ['server/index.ts', 'scripts/import-questions.ts', 'scripts/db-migrate.ts'],
  outbase: '.',
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
});

await cp('server/db/migrations', 'dist/server/db/migrations', { recursive: true });
