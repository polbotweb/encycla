export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  log(level: LogLevel, event: string, data?: Record<string, unknown>): void;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const REDACTED_KEYS = /token|cookie|authorization|secret|password/i;

export function redact(data: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!data) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      REDACTED_KEYS.test(key) ? '[redacted]' : value,
    ]),
  );
}

export function createLogger(minLevel: LogLevel = 'info'): Logger {
  return {
    log(level, event, data) {
      if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) {
        return;
      }
      const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...redact(data) });
      if (level === 'error' || level === 'warn') {
        process.stderr.write(`${line}\n`);
      } else {
        process.stdout.write(`${line}\n`);
      }
    },
  };
}

export const silentLogger: Logger = { log() {} };

export function parseLogLevel(value: string | undefined): LogLevel {
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error'
    ? value
    : 'info';
}
