import type { ServerConfig } from '../config';
import { normalizeHandle, type TikTokAdapterFactory } from './adapter';
import { FakeTikTokAdapter } from './fakeAdapter';
import { LiveTikTokAdapter, type ConnectorModuleLoader } from './liveAdapter';

export interface TikTokSetup {
  factory: TikTokAdapterFactory;
  /** Live followed at startup (`TIKTOK_USERNAME`), null until a room names one. */
  defaultTarget: string | null;
  simulated: boolean;
}

/**
 * The TikTok wiring for a configuration: none when disabled, the simulated chat with
 * `TIKTOK_ADAPTER=fake` (demos, end-to-end tests), else the optional tiktok-live-connector
 * following `TIKTOK_USERNAME` or the live a room names.
 */
export function tiktokSetup(
  config: Pick<
    ServerConfig,
    | 'tiktokEnabled'
    | 'tiktokAdapter'
    | 'tiktokUsername'
    | 'tiktokSessionCookie'
    | 'tiktokSignApiKey'
  >,
  loadModule?: ConnectorModuleLoader,
): TikTokSetup | null {
  if (!config.tiktokEnabled) return null;
  const defaultTarget = config.tiktokUsername ? normalizeHandle(config.tiktokUsername) : null;
  if (config.tiktokAdapter === 'fake') {
    return { factory: () => new FakeTikTokAdapter(), defaultTarget, simulated: true };
  }
  const sessionCookie = config.tiktokSessionCookie;
  if (sessionCookie === null) return null;
  return {
    factory: (target) =>
      new LiveTikTokAdapter(
        { username: target, sessionCookie, signApiKey: config.tiktokSignApiKey },
        ...(loadModule ? [loadModule] : []),
      ),
    defaultTarget,
    simulated: false,
  };
}

/** `createGameServer` options for a setup. */
export function tiktokOptions(setup: TikTokSetup | null): {
  tiktokAdapterFactory: TikTokAdapterFactory | null;
  tiktokDefaultTarget: string | null;
  tiktokSimulated: boolean;
} {
  return {
    tiktokAdapterFactory: setup?.factory ?? null,
    tiktokDefaultTarget: setup?.defaultTarget ?? null,
    tiktokSimulated: setup?.simulated ?? false,
  };
}
