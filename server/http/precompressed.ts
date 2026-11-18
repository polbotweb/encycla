import { existsSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import type { RequestHandler } from 'express';

const ENCODINGS = [
  { token: 'br', suffix: '.br' },
  { token: 'gzip', suffix: '.gz' },
] as const;

/** Content codings the client accepts (q > 0), from an Accept-Encoding header. */
export function acceptedEncodings(header: string | undefined): Set<string> {
  const accepted = new Set<string>();
  for (const part of (header ?? '').split(',')) {
    const [rawToken, ...params] = part.trim().split(';');
    const token = rawToken?.trim().toLowerCase();
    if (!token) continue;
    const q = params.map((param) => param.trim()).find((param) => param.startsWith('q='));
    if (q !== undefined && !(Number(q.slice(2)) > 0)) continue;
    accepted.add(token);
  }
  return accepted;
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * Serves the `.br` / `.gz` siblings written by `scripts/compress-assets.mjs` for hashed assets,
 * with the original Content-Type and `Vary: Accept-Encoding`. Falls through to express.static.
 */
export function precompressedAssets(staticDir: string): RequestHandler {
  const root = resolve(staticDir);
  return (request, response, next) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return next();
    if (!request.path.startsWith('/assets/')) return next();
    let file: string;
    try {
      file = resolve(root, `.${decodeURIComponent(request.path)}`);
    } catch {
      return next();
    }
    if (!file.startsWith(root + sep) || !isFile(file)) return next();
    const variants = ENCODINGS.filter(({ suffix }) => existsSync(file + suffix));
    if (variants.length === 0) return next();
    response.vary('Accept-Encoding');
    const accepted = acceptedEncodings(request.get('accept-encoding'));
    const chosen = variants.find(({ token }) => accepted.has(token));
    if (!chosen) return next();
    response.type(extname(file));
    response.setHeader('Content-Encoding', chosen.token);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.sendFile(file + chosen.suffix, (error) => {
      if (error) next(error);
    });
  };
}
