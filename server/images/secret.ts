import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

export const MIN_IMAGE_TOKEN_SECRET_LENGTH = 32;
export const IMAGE_TOKEN_SECRET_FILE = 'image-token.secret';

export interface ImageTokenSecret {
  secret: Buffer;
  source: 'env' | 'file' | 'generated' | 'ephemeral';
  path?: string;
}

/**
 * Key of the image tokens (D-116): `IMAGE_TOKEN_SECRET` when set, else a random key generated
 * once and kept next to the database (`data/image-token.secret`, mode 600) so image links of the
 * running rounds survive a restart. A read-only volume falls back to a per-process key.
 */
export function loadImageTokenSecret(
  value: string | null | undefined,
  dataDir: string | null,
): ImageTokenSecret {
  const fromEnv = value?.trim();
  if (fromEnv) {
    return { secret: createHash('sha256').update(fromEnv).digest(), source: 'env' };
  }
  if (!dataDir) return { secret: randomBytes(32), source: 'ephemeral' };
  const path = join(dataDir, IMAGE_TOKEN_SECRET_FILE);
  try {
    if (existsSync(path)) {
      const hex = readFileSync(path, 'utf8').trim();
      if (/^[0-9a-f]{64}$/.test(hex))
        return { secret: Buffer.from(hex, 'hex'), source: 'file', path };
    }
    const secret = randomBytes(32);
    mkdirSync(dirname(path), { recursive: true });
    const temp = `${path}.${process.pid}.tmp`;
    writeFileSync(temp, `${secret.toString('hex')}\n`, { mode: 0o600 });
    renameSync(temp, path);
    chmodSync(path, 0o600);
    return { secret, source: 'generated', path };
  } catch {
    return { secret: randomBytes(32), source: 'ephemeral' };
  }
}
