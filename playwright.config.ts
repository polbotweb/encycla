import { defineConfig, devices } from '@playwright/test';

/** `pnpm docs:screenshots`: README captures, on their own servers and database. */
export const SCREENSHOTS = process.env.DOCS_SCREENSHOTS === '1';
/** Web-only server: TikTok disabled, as most deployments run. */
export const PORT = SCREENSHOTS ? 3110 : 3100;
/** TikTok server: simulated chat (`TIKTOK_ADAPTER=fake`), streamer console unlocked by a test token. */
export const TIKTOK_PORT = SCREENSHOTS ? 3111 : 3101;
const DB = SCREENSHOTS ? 'data/screenshots' : 'data/e2e';
/** Screenshots keep proxied Commons images on disk so a rerun does not depend on Wikimedia. */
const IMAGE_CACHE_DIR = SCREENSHOTS ? 'data/image-cache' : '';
export const E2E_ADMIN_TOKEN = process.env.E2E_ADMIN_TOKEN ?? 'e2e-admin-secret-for-tests';

/**
 * Against an already running deployment (production-like runs, staging): `E2E_BASE_URL` for the
 * web-only server, `E2E_TIKTOK_BASE_URL` for a TikTok-enabled one; no local server is started.
 */
const EXTERNAL_BASE_URL = process.env.E2E_BASE_URL;
const EXTERNAL_TIKTOK_BASE_URL = process.env.E2E_TIKTOK_BASE_URL;
const EXTERNAL = Boolean(EXTERNAL_BASE_URL || EXTERNAL_TIKTOK_BASE_URL);

/** Specs that cover the three web ways to play; they also run on phones. */
const PLAY_SPECS = /play-modes\.spec\.ts/;
const TIKTOK_SPECS = /tiktok\.spec\.ts/;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: EXTERNAL_BASE_URL ?? `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
    ignoreHTTPSErrors: EXTERNAL,
  },
  projects: SCREENSHOTS
    ? [
        {
          name: 'screenshots',
          testMatch: /screenshots\.spec\.ts/,
          use: { ...devices['Desktop Chrome'] },
        },
      ]
    : [
        {
          name: 'chromium',
          testIgnore: [TIKTOK_SPECS, /screenshots\.spec\.ts/],
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'mobile-pixel',
          testMatch: PLAY_SPECS,
          use: { ...devices['Pixel 7'] },
        },
        {
          // iPhone viewport, touch and user agent, rendered by Chromium (no WebKit in CI images).
          name: 'mobile-iphone',
          testMatch: PLAY_SPECS,
          use: { ...devices['iPhone 14'], browserName: 'chromium', defaultBrowserType: 'chromium' },
        },
        {
          name: 'tiktok',
          testMatch: TIKTOK_SPECS,
          use: {
            ...devices['Desktop Chrome'],
            baseURL: EXTERNAL_TIKTOK_BASE_URL ?? `http://127.0.0.1:${TIKTOK_PORT}`,
          },
        },
      ],
  // Production-like: Express serves the Vite build and the API on one origin.
  webServer: EXTERNAL
    ? []
    : [
        {
          command: 'pnpm run build && node dist/server/index.js',
          url: `http://127.0.0.1:${PORT}/api/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          env: {
            PORT: String(PORT),
            DATABASE_PATH: `${DB}.db`,
            LOG_LEVEL: 'warn',
            TIKTOK_ENABLED: 'false',
            IMAGE_CACHE_DIR,
            RATE_LIMIT: 'off',
          },
        },
        {
          command: 'node scripts/e2e/start-after-build.mjs',
          url: `http://127.0.0.1:${TIKTOK_PORT}/api/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 240_000,
          env: {
            E2E_BUILD_SERVER: `http://127.0.0.1:${PORT}/api/health`,
            PORT: String(TIKTOK_PORT),
            DATABASE_PATH: `${DB}-tiktok.db`,
            LOG_LEVEL: 'warn',
            TIKTOK_ENABLED: 'true',
            TIKTOK_ADAPTER: 'fake',
            TIKTOK_USERNAME: 'encycla_demo',
            ADMIN_TOKEN: E2E_ADMIN_TOKEN,
            IMAGE_CACHE_DIR,
            RATE_LIMIT: 'off',
          },
        },
      ],
});
