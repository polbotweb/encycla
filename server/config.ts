import { normalizeHandle } from './tiktok/adapter';

export const VERSION = '1.0.0';

export interface ServerConfig {
  port: number;
  publicOrigin: string | null;
  databasePath: string;
  logLevel: string;
  adminToken: string | null;
  tiktokEnabled: boolean;
  /** `live` (tiktok-live-connector) or `fake` (simulated chat for demos and e2e tests). */
  tiktokAdapter: 'live' | 'fake';
  tiktokUsername: string | null;
  /** Secret. Never log, never expose through the API. */
  tiktokSessionCookie: string | null;
  /** Optional Euler Stream signing key for the connector. Secret. */
  tiktokSignApiKey: string | null;
  /** Number of reverse proxies in front of the server (`false` when exposed directly). */
  trustProxy: false | number;
  /** `RATE_LIMIT=off`: load tests only, refused in production. */
  rateLimit: boolean;
  staticDir: string;
  /** Disk cache of proxied Commons images (D-107); empty `IMAGE_CACHE_DIR` = memory only. */
  imageCacheDir: string | null;
  imageCacheMaxBytes: number;
  /** Secret. Key of the image tokens (D-116); absent: generated once in the data directory. */
  imageTokenSecret: string | null;
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${value}`);
  }
  return port;
}

function parseCacheMegabytes(value: string | undefined): number {
  const megabytes = Number(value?.trim() || '512');
  if (!Number.isInteger(megabytes) || megabytes < 1 || megabytes > 100_000) {
    throw new Error(`Invalid IMAGE_CACHE_MAX_MB: ${value}`);
  }
  return megabytes;
}

/**
 * `TRUST_PROXY`: unset/`false` → not trusted; `true` → exactly one proxy; `N` → N hops. Never
 * Express' `true` (trust everything), which would let clients forge their IP and dodge rate limits.
 */
function parseTrustProxy(value: string | undefined): false | number {
  const raw = value?.trim().toLowerCase() ?? '';
  if (raw === '' || raw === 'false' || raw === '0') {
    return false;
  }
  if (raw === 'true') {
    return 1;
  }
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 1 || hops > 10) {
    throw new Error(`Invalid TRUST_PROXY: ${value} (use false, true or a hop count 1-10)`);
  }
  return hops;
}

/** Placeholders that must never grant admin access, whatever their length. */
const PLACEHOLDER_TOKENS = new Set([
  'change-me',
  'changeme',
  'admin',
  'password',
  'secret',
  'token',
]);
/** Minimum admin token length outside production / in production (`openssl rand -hex 32` = 64). */
export const MIN_ADMIN_TOKEN_LENGTH = 16;
export const MIN_PRODUCTION_ADMIN_TOKEN_LENGTH = 32;

/** Why an admin token is unacceptable, or `null` when it is fine. */
export function adminTokenProblem(token: string, production: boolean): string | null {
  const minimum = production ? MIN_PRODUCTION_ADMIN_TOKEN_LENGTH : MIN_ADMIN_TOKEN_LENGTH;
  if (PLACEHOLDER_TOKENS.has(token.toLowerCase())) {
    return 'is a documented placeholder';
  }
  if (token.length < minimum) {
    return `is shorter than ${minimum} characters`;
  }
  if (/\s/.test(token)) {
    return 'contains whitespace';
  }
  if (new Set(token).size < 8) {
    return 'is not random enough (fewer than 8 distinct characters)';
  }
  return null;
}

/** The documented placeholder must never grant admin access. */
function parseAdminToken(value: string | undefined): string | null {
  const token = value?.trim();
  return token && adminTokenProblem(token, false) === null ? token : null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: parsePort(env.PORT),
    publicOrigin: env.PUBLIC_ORIGIN ?? null,
    databasePath: env.DATABASE_PATH ?? 'data/encycla.db',
    logLevel: env.LOG_LEVEL ?? 'info',
    adminToken: parseAdminToken(env.ADMIN_TOKEN),
    tiktokEnabled: env.TIKTOK_ENABLED === 'true',
    tiktokAdapter: env.TIKTOK_ADAPTER?.trim().toLowerCase() === 'fake' ? 'fake' : 'live',
    tiktokUsername: env.TIKTOK_USERNAME?.trim() || null,
    tiktokSessionCookie: env.TIKTOK_SESSION_COOKIE?.trim() || null,
    tiktokSignApiKey: env.TIKTOK_SIGN_API_KEY?.trim() || null,
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    rateLimit: env.RATE_LIMIT !== 'off',
    staticDir: env.STATIC_DIR ?? 'dist/client',
    imageCacheDir:
      env.IMAGE_CACHE_DIR === undefined ? 'data/image-cache' : env.IMAGE_CACHE_DIR.trim() || null,
    imageCacheMaxBytes: parseCacheMegabytes(env.IMAGE_CACHE_MAX_MB) * 1024 * 1024,
    imageTokenSecret: env.IMAGE_TOKEN_SECRET?.trim() || null,
  };
}

/** Startup validation (DEPLOYMENT 6.1). Returns human-readable problems; empty means valid. */
export function validateConfig(
  config: ServerConfig,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const problems: string[] = [];
  const production = env.NODE_ENV === 'production';
  const rawToken = env.ADMIN_TOKEN?.trim() ?? '';
  const generate = 'generate one with `openssl rand -hex 32`';
  if (rawToken === '') {
    if (production) {
      problems.push(`ADMIN_TOKEN is required in production (${generate}).`);
    }
  } else {
    // A token that is set but rejected would silently disable the admin routes: fail fast instead.
    // Outside production the "change-me" placeholder of .env.example is tolerated (admin disabled).
    const problem = adminTokenProblem(rawToken, production);
    const tolerated = !production && rawToken.toLowerCase() === 'change-me';
    if (problem !== null && !tolerated) {
      problems.push(`ADMIN_TOKEN ${problem}; ${generate}.`);
    }
  }
  if (production) {
    if (config.publicOrigin === null) {
      problems.push('PUBLIC_ORIGIN is required in production.');
    } else if (!/^https:\/\/[^/\s]+$/.test(config.publicOrigin)) {
      problems.push(
        'PUBLIC_ORIGIN must be an https origin without a path in production (https://host[:port]).',
      );
    }
  }
  if (config.imageTokenSecret !== null && config.imageTokenSecret.length < 32) {
    problems.push('IMAGE_TOKEN_SECRET must be at least 32 characters (`openssl rand -hex 32`).');
  }
  if (!config.rateLimit && env.NODE_ENV === 'production') {
    problems.push('RATE_LIMIT=off is not allowed in production.');
  }
  const adapter = env.TIKTOK_ADAPTER?.trim().toLowerCase();
  if (adapter !== undefined && adapter !== '' && adapter !== 'live' && adapter !== 'fake') {
    problems.push('TIKTOK_ADAPTER must be `live` (default) or `fake`.');
  }
  if (config.tiktokUsername !== null && normalizeHandle(config.tiktokUsername) === null) {
    problems.push('TIKTOK_USERNAME must be a TikTok handle (letters, digits, "." or "_").');
  }
  // The live adapter needs a session; the live to follow may be named per room (any live).
  if (
    config.tiktokEnabled &&
    config.tiktokAdapter === 'live' &&
    config.tiktokSessionCookie === null
  ) {
    problems.push('TIKTOK_SESSION_COOKIE is required when TIKTOK_ENABLED=true.');
  }
  return problems;
}
