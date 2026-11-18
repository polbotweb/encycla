import { mkdirSync } from 'node:fs';
import { expect, test, devices, type Browser, type Page } from '@playwright/test';
import { translate, type MessageKey } from '../../client/i18n';
import type { Language } from '../../shared/languages';
import { E2E_ADMIN_TOKEN, PORT, TIKTOK_PORT } from '../../playwright.config';

/**
 * `pnpm docs:screenshots`: real captures of the built app for the README (docs/screenshots/).
 * Nothing is mocked: the server is the production build, questions and images are the real bank
 * (Commons images through the /img proxy, kept in data/image-cache), the TikTok screens use the
 * simulated chat. A capture fails if any visible image did not load.
 */

const OUT = 'docs/screenshots';
const WEB = `http://127.0.0.1:${PORT}`;
const TIKTOK = `http://127.0.0.1:${TIKTOK_PORT}`;
const OPTION = /^[A-D] /;
mkdirSync(OUT, { recursive: true });

type Device = 'desktop' | 'mobile';

async function context(browser: Browser, device: Device) {
  return browser.newContext(
    device === 'mobile'
      ? { ...devices['Pixel 7'] }
      : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  );
}

/** Every visible <img> decoded with real pixels (no broken image in the docs). */
async function imagesLoaded(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          [...document.images]
            .filter((image) => image.getBoundingClientRect().width > 0)
            .every((image) => image.complete && image.naturalWidth > 0),
        ),
      { timeout: 30_000, message: 'images did not load' },
    )
    .toBe(true);
}

async function shot(page: Page, name: string, fullPage = false): Promise<void> {
  await imagesLoaded(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage, animations: 'disabled' });
}

function tr(language: Language) {
  return (key: MessageKey, params: Record<string, string | number> = {}) =>
    translate(key, params, language);
}

async function soloToQuestion(page: Page, language: Language, pseudo: string) {
  const t = tr(language);
  await page.goto(`${WEB}/?lang=${language}`);
  await page.getByLabel(t('home.pseudo')).fill(pseudo);
  await page.getByRole('button', { name: t('home.soloClassic') }).click();
  await page.getByRole('button', { name: t('setup.startSolo') }).click();
  await expect(page.locator('#question-title')).toBeVisible({ timeout: 15_000 });
}

/** Answers and continues until the final ranking (three wrong answers end a solo game). */
async function playToResults(page: Page, language: Language) {
  const t = tr(language);
  const ranking = page.getByRole('table', { name: t('results.finalRanking') });
  const options = page.getByRole('button', { name: OPTION });
  const proceed = page.getByRole('button', { name: t('common.continue') });
  for (let round = 0; round < 120 && !(await ranking.isVisible()); round += 1) {
    if ((await options.count()) === 4 && (await options.first().isEnabled())) {
      await options.nth(round % 4).click();
    } else if ((await proceed.isVisible()) && (await proceed.isEnabled())) {
      await proceed.click();
    }
    await page.waitForTimeout(300);
  }
  await expect(ranking).toBeVisible();
}

/** Two players answer and continue until both see the final ranking. */
async function duelToResults(pages: Page[], language: Language) {
  const t = tr(language);
  const done = new Set<number>();
  for (let round = 0; round < 400 && done.size < pages.length; round += 1) {
    for (const [index, page] of pages.entries()) {
      if (await page.getByRole('table', { name: t('results.finalRanking') }).isVisible()) {
        done.add(index);
        continue;
      }
      const options = page.getByRole('button', { name: OPTION });
      const proceed = page.getByRole('button', { name: t('common.continue') });
      if ((await options.count()) === 4 && (await options.first().isEnabled())) {
        await options.nth((round + index) % 4).click();
      } else if ((await proceed.isVisible()) && (await proceed.isEnabled())) {
        await proceed.click();
      }
    }
    await pages[0]!.waitForTimeout(250);
  }
  expect(done.size).toBe(pages.length);
}

test.describe.configure({ mode: 'serial' });

test('player screens, desktop, French', async ({ browser }) => {
  test.setTimeout(300_000);
  const t = tr('fr');
  const ctx = await context(browser, 'desktop');
  const page = await ctx.newPage();

  await page.goto(`${WEB}/?lang=fr`);
  await expect(page.getByRole('button', { name: t('home.soloClassic') })).toBeVisible();
  await shot(page, 'desktop-fr-home');

  await page.getByLabel(t('home.pseudo')).fill('Camille');
  await page.getByRole('button', { name: t('home.soloSubject') }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page
    .locator('#category option:not([disabled]):not([value=""])')
    .first()
    .waitFor({ state: 'attached' });
  const category = await page
    .locator('#category option:not([disabled]):not([value=""])')
    .first()
    .getAttribute('value');
  await page.locator('#category').selectOption(category!);
  await shot(page, 'desktop-fr-setup');
  await page.keyboard.press('Escape');

  await soloToQuestion(page, 'fr', 'Camille');
  await shot(page, 'desktop-fr-question');
  await page.getByRole('button', { name: OPTION }).first().click();
  await expect(page.getByRole('group', { name: t('reveal.answers') })).toBeVisible();
  await shot(page, 'desktop-fr-reveal');
  await expect(page.getByRole('article')).toBeVisible({ timeout: 15_000 });
  await shot(page, 'desktop-fr-article');
  await playToResults(page, 'fr');
  await shot(page, 'desktop-fr-results');
  // Leave the finished room (a reload would reconnect to it until its TTL).
  await page.getByRole('button', { name: t('common.backHome') }).click();

  // Solo games are not ranked: two real public duels (CONTEST) fill the leaderboard.
  for (const pair of [
    ['Camille', 'Yanis'],
    ['Léa', 'Samir'],
  ]) {
    const players = [];
    for (const pseudo of pair) {
      const player = await (await context(browser, 'desktop')).newPage();
      await player.goto(`${WEB}/?lang=fr`);
      await player.getByLabel(t('home.pseudo')).fill(pseudo);
      await player.getByRole('button', { name: t('home.playOnline') }).click();
      await player.getByRole('radio', { name: t('mode.CONTEST.desc') }).check();
      await player.getByRole('button', { name: t('setup.startQueue') }).click();
      players.push(player);
    }
    await duelToResults(players, 'fr');
    if (pair[0] === 'Camille') await shot(players[0]!, 'desktop-fr-duel-results');
    for (const player of players) await player.context().close();
  }
  await page.goto(`${WEB}/?mode=leaderboard&lang=fr`);
  await expect(page.getByRole('heading', { name: t('leaderboard.title') })).toBeVisible();
  await expect(page.getByText('Camille').first()).toBeVisible({ timeout: 10_000 });
  await shot(page, 'desktop-fr-leaderboard');

  await page.goto(`${WEB}/?lang=fr`);
  await page.getByRole('button', { name: t('home.playOnline') }).click();
  await page.getByRole('button', { name: t('setup.startQueue') }).click();
  await expect(page.getByRole('heading', { name: t('queue.searching') })).toBeVisible();
  await page.waitForTimeout(2_000);
  await shot(page, 'desktop-fr-matchmaking');
  await page.getByRole('button', { name: t('common.cancel') }).click();

  // Private room lobby with a guest.
  await page.getByRole('button', { name: t('home.createPrivate') }).click();
  await page.getByRole('button', { name: t('setup.startPrivate') }).click();
  const code = (await page.getByTestId('room-code').textContent())!.trim();
  const guest = await (await context(browser, 'desktop')).newPage();
  await guest.goto(`${WEB}/?mode=join&code=${code}&lang=fr`);
  await guest.getByRole('dialog').getByLabel(t('home.pseudo')).fill('Yanis');
  await guest
    .getByRole('dialog')
    .getByRole('button', { name: t('home.join'), exact: true })
    .click();
  await expect(page.getByText('Yanis')).toBeVisible({ timeout: 10_000 });
  await guest.getByRole('button', { name: t('lobby.ready'), exact: true }).click();
  await shot(page, 'desktop-fr-lobby');
  await guest.context().close();
  await ctx.close();
});

test('player screens, mobile, French', async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await context(browser, 'mobile');
  const page = await ctx.newPage();
  await page.goto(`${WEB}/?lang=fr`);
  await shot(page, 'mobile-fr-home');
  await soloToQuestion(page, 'fr', 'Camille');
  await shot(page, 'mobile-fr-question');
  await page.getByRole('button', { name: OPTION }).first().click();
  await expect(page.getByRole('article')).toBeVisible({ timeout: 15_000 });
  await shot(page, 'mobile-fr-article');
  await playToResults(page, 'fr');
  await shot(page, 'mobile-fr-results');
  await ctx.close();
});

test('Arabic, right to left', async ({ browser }) => {
  test.setTimeout(120_000);
  for (const device of ['desktop', 'mobile'] as const) {
    const ctx = await context(browser, device);
    const page = await ctx.newPage();
    await page.goto(`${WEB}/?lang=ar`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await shot(page, `${device}-ar-home`);
    await soloToQuestion(page, 'ar', 'Camille');
    await shot(page, `${device}-ar-question`);
    await ctx.close();
  }
});

test('TikTok: streamer console, OBS overlay and control console', async ({ browser }) => {
  test.setTimeout(180_000);
  const t = tr('fr');
  const ctx = await context(browser, 'desktop');
  const admin = await ctx.newPage();
  await admin.goto(`${TIKTOK}/?mode=admin&lang=fr`);
  await admin.getByLabel(t('admin.token')).fill(E2E_ADMIN_TOKEN);
  await admin.getByRole('button', { name: t('admin.unlock') }).click();
  await expect(admin.getByText(t('admin.simulated'))).toBeVisible();
  const close = admin.getByRole('button', { name: t('admin.closeRoom') });
  if (await close.isVisible()) await close.click();
  await admin.getByRole('button', { name: t('admin.createButton') }).click();
  await expect(admin.getByTestId('admin-room-code')).toBeVisible();
  await admin.getByLabel(t('admin.token')).fill('');
  await shot(admin, 'desktop-fr-tiktok-admin', true);

  const overlayUrl = await admin.getByLabel(t('admin.overlayLink')).inputValue();
  const controlUrl = await admin.getByLabel(t('admin.controlLink')).inputValue();
  const overlay = await ctx.newPage();
  await overlay.setViewportSize({ width: 1920, height: 1080 });
  await overlay.goto(overlayUrl);
  const control = await ctx.newPage();
  await control.goto(controlUrl);
  await control.getByRole('button', { name: t('control.start') }).click();
  await expect(overlay.getByRole('timer')).toBeVisible({ timeout: 10_000 });

  await admin.getByLabel(t('admin.token')).fill(E2E_ADMIN_TOKEN);
  const viewers = ['camille_live', 'yanis.tv', 'lea_quiz', 'samir', 'ines_92', 'hugo'];
  for (const [index, viewer] of viewers.entries()) {
    await admin.request.post(`${TIKTOK}/api/admin/tiktok/chat`, {
      headers: { Authorization: `Bearer ${E2E_ADMIN_TOKEN}` },
      data: { uniqueId: viewer, comment: 'ABCD'[index % 4] },
    });
  }
  await expect(control.getByText(t('control.viewers', { count: 6, max: 100 }))).toBeVisible();
  await shot(overlay, 'desktop-fr-tiktok-overlay-question');
  await shot(control, 'desktop-fr-tiktok-control', true);
  await control.getByRole('button', { name: t('control.skip'), exact: true }).click();
  await control
    .getByRole('dialog')
    .getByRole('button', { name: t('common.confirm') })
    .click();
  await expect(overlay.getByText('camille_live').first()).toBeVisible();
  await shot(overlay, 'desktop-fr-tiktok-overlay-reveal');

  await admin.getByRole('button', { name: t('admin.closeRoom') }).click();
  await ctx.close();
});
