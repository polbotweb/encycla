// Precompresses the hashed client assets (brotli + gzip) so the server can send them without
// compressing on every request. Run after `vite build`.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { argv, stdout } from 'node:process';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const ROOT = argv[2] ?? 'dist/client/assets';
const COMPRESSIBLE = new Set(['.js', '.css', '.svg', '.json', '.html', '.txt', '.map']);
const MIN_BYTES = 1024;

let saved = 0;
let count = 0;
for (const name of readdirSync(ROOT)) {
  const file = join(ROOT, name);
  if (!statSync(file).isFile() || !COMPRESSIBLE.has(extname(name))) continue;
  const source = readFileSync(file);
  if (source.length < MIN_BYTES) continue;
  const br = brotliCompressSync(source, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
      [constants.BROTLI_PARAM_SIZE_HINT]: source.length,
    },
  });
  const gz = gzipSync(source, { level: 9 });
  if (br.length < source.length) writeFileSync(`${file}.br`, br);
  if (gz.length < source.length) writeFileSync(`${file}.gz`, gz);
  saved += source.length - Math.min(br.length, source.length);
  count += 1;
}
stdout.write(
  `compress-assets: ${count} files, ${Math.round(saved / 1024)} KiB saved with brotli\n`,
);
