export const VERSION = '1.0.0';

export interface ServerConfig {
  port: number;
  publicOrigin: string | null;
  databasePath: string;
  logLevel: string;
  adminToken: string | null;
  tiktokEnabled: boolean;
  tiktokUsername: string | null;
  /** Secret. Never log, never expose through the API. */
  tiktokSessionCookie: string | null;
  trustProxy: boolean;
  staticDir: string;
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${value}`);
  }
  return port;
}

/** The documented placeholder must never grant admin access. */
function parseAdminToken(value: string | undefined): string | null {
  const token = value?.trim();
  return token && token !== 'change-me' && token.length >= 16 ? token : null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: parsePort(env.PORT),
    publicOrigin: env.PUBLIC_ORIGIN ?? null,
    databasePath: env.DATABASE_PATH ?? 'data/encycla.db',
    logLevel: env.LOG_LEVEL ?? 'info',
    adminToken: parseAdminToken(env.ADMIN_TOKEN),
    tiktokEnabled: env.TIKTOK_ENABLED === 'true',
    tiktokUsername: env.TIKTOK_USERNAME?.trim() || null,
    tiktokSessionCookie: env.TIKTOK_SESSION_COOKIE?.trim() || null,
    trustProxy: env.TRUST_PROXY === 'true',
    staticDir: env.STATIC_DIR ?? 'dist',
  };
}

/** Startup validation (DEPLOYMENT 6.1). Returns human-readable problems; empty means valid. */
export function validateConfig(
  config: ServerConfig,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const problems: string[] = [];
  if (env.NODE_ENV === 'production') {
    if (config.adminToken === null) {
      problems.push(
        'ADMIN_TOKEN (at least 16 characters, not "change-me") is required in production.',
      );
    }
    if (config.publicOrigin === null) {
      problems.push('PUBLIC_ORIGIN is required in production.');
    }
  }
  if (config.tiktokEnabled) {
    if (config.tiktokUsername === null) {
      problems.push('TIKTOK_USERNAME is required when TIKTOK_ENABLED=true.');
    }
    if (config.tiktokSessionCookie === null) {
      problems.push('TIKTOK_SESSION_COOKIE is required when TIKTOK_ENABLED=true.');
    }
  }
  return problems;
}
