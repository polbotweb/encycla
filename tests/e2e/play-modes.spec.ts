import {
  expect,
  test,
  type Browser,
  type BrowserContextOptions,
  type Page,
} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { translate } from '../../client/i18n';
import type { Language } from '../../shared/languages';

/**
 * The web game without TikTok, on desktop and on phones (Pixel 7, iPhone 14 emulation with touch):
 * solo to the results, a private room and public matchmaking, in French, English and Arabic.
 */

const LANGUAGES: Language[] = ['fr', 'en', 'ar'];
const OPTION = /^[A-D] /;
/** Seed wording of the Dogs questions (scripts/wikimedia/languages.ts). */
const DOG_QUESTION: Record<Language, string> = {
  fr: 'Quelle est cette race de chien ?',
  en: 'What is this dog breed?',
  ar: 'ما سلالة هذا الكلب؟',
};

/** A fresh context with the same device as the project (viewport, touch, user agent). */
async function deviceContext(
  browser: Browser,
): Promise<BrowserContextOptions & { touch: boolean }> {
  const use = test.info().project.use;
  const options: BrowserContextOptions = {
    ...(use.viewport ? { viewport: use.viewport } : {}),
    ...(use.userAgent ? { userAgent: use.userAgent } : {}),
    ...(use.deviceScaleFactor ? { deviceScaleFactor: use.deviceScaleFactor } : {}),
    ...(use.isMobile ? { isMobile: use.isMobile } : {}),
    ...(use.hasTouch ? { hasTouch: use.hasTouch } : {}),
    ...(use.baseURL ? { baseURL: use.baseURL } : {}),
  };
  void browser;
  return { ...options, touch: use.hasTouch === true };
}

/** Taps on touch devices, clicks elsewhere. */
async function press(page: Page, locator: ReturnType<Page['locator']>, touch: boolean) {
  if (touch) await locator.tap();
  else await locator.click();
}

/** Collects console errors and failed requests to the app itself (never TikTok, never 4xx/5xx). */
function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' && !text.includes('upload.wikimedia.org')) problems.push(text);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.host === new URL(page.url() || 'http://x').host && response.status() >= 400) {
      problems.push(`${response.status()} ${url.pathname}`);
    }
  });
  return problems;
}

async function noHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function openHome(page: Page, language: Language): Promise<void> {
  await page.goto(`/?lang=${language}`);
  await expect(page.locator('html')).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
  await expect(page.getByTestId('logo-wordmark').first()).toBeVisible();
}

async function nickname(page: Page, language: Language, name: string, touch: boolean) {
  const field = page.getByLabel(translate('home.pseudo', {}, language));
  await press(page, field, touch);
  await field.fill(name);
}

/** Answers with `letter` and moves on until the final ranking shows (or `rounds` run out). */
async function playToResults(page: Page, language: Language, touch: boolean): Promise<void> {
  const ranking = page.getByRole('table', {
    name: translate('results.finalRanking', {}, language),
  });
  const options = page.getByRole('button', { name: OPTION });
  const proceed = page.getByRole('button', { name: translate('common.continue', {}, language) });
  for (let round = 0; round < 80; round += 1) {
    if (await ranking.isVisible()) return;
    if ((await options.count()) === 4 && (await options.first().isEnabled())) {
      await press(page, options.first(), touch);
    } else if ((await proceed.isVisible()) && (await proceed.isEnabled())) {
      await press(page, proceed, touch);
    }
    await page.waitForTimeout(400);
  }
  await expect(ranking).toBeVisible();
}

for (const language of LANGUAGES) {
  test.describe(`web game without TikTok · ${language}`, () => {
    test('solo by subject in a new category (D-122): Dogs plays, Cats stays disabled', async ({
      browser,
    }) => {
      test.setTimeout(90_000);
      const { touch, ...options } = await deviceContext(browser);
      const context = await browser.newContext(options);
      const page = await context.newPage();
      const problems = watch(page);
      await openHome(page, language);
      await nickname(page, language, 'Dora', touch);
      await press(
        page,
        page.getByRole('button', { name: translate('home.soloClassic', {}, language) }),
        touch,
      );
      await press(page, page.getByText(translate('mode.SUBJECT.desc', {}, language)), touch);
      const category = page.locator('#category');
      await expect(category.locator('option[value="Cats"]')).toBeDisabled();
      await expect(category.locator('option[value="Dogs"]')).toBeEnabled();
      await category.selectOption('Dogs');
      const scan = await new AxeBuilder({ page }).analyze();
      expect(
        scan.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')),
      ).toEqual([]);
      await noHorizontalScroll(page);
      await press(
        page,
        page.getByRole('button', { name: translate('setup.startSolo', {}, language) }),
        touch,
      );
      const title = page.locator('#question-title');
      await expect(title).toBeVisible({ timeout: 15_000 });
      await expect(title).toHaveText(DOG_QUESTION[language]);
      await expect(page.getByRole('button', { name: OPTION })).toHaveCount(4);
      expect(problems).toEqual([]);
      await context.close();
    });

    test('solo classic: question, answer, article, results', async ({ browser }) => {
      test.setTimeout(180_000);
      const { touch, ...options } = await deviceContext(browser);
      const context = await browser.newContext(options);
      const page = await context.newPage();
      const problems = watch(page);
      await openHome(page, language);
      await noHorizontalScroll(page);
      await nickname(page, language, 'Alice', touch);
      await press(
        page,
        page.getByRole('button', { name: translate('home.soloClassic', {}, language) }),
        touch,
      );
      await press(
        page,
        page.getByRole('button', { name: translate('setup.startSolo', {}, language) }),
        touch,
      );
      const title = page.locator('#question-title');
      await expect(title).toBeVisible({ timeout: 15_000 });
      await expect(title).toHaveAttribute('lang', language);
      await expect(page.getByRole('button', { name: OPTION })).toHaveCount(4);
      await noHorizontalScroll(page);
      await playToResults(page, language, touch);
      await noHorizontalScroll(page);
      await press(
        page,
        page.getByRole('button', { name: translate('common.backHome', {}, language) }),
        touch,
      );
      await expect(
        page.getByRole('button', { name: translate('home.soloClassic', {}, language) }),
      ).toBeVisible();
      expect(problems).toEqual([]);
      await context.close();
    });

    test('private room: create, join with the code, play a question', async ({ browser }) => {
      test.setTimeout(90_000);
      const { touch, ...options } = await deviceContext(browser);
      const hostContext = await browser.newContext(options);
      const guestContext = await browser.newContext(options);
      const host = await hostContext.newPage();
      const guest = await guestContext.newPage();
      const problems = [...watch(host), ...watch(guest)];
      const t = (key: Parameters<typeof translate>[0]) => translate(key, {}, language);

      await openHome(host, language);
      await nickname(host, language, 'Hostess', touch);
      await press(host, host.getByRole('button', { name: t('home.createPrivate') }), touch);
      await press(host, host.getByRole('button', { name: t('setup.startPrivate') }), touch);
      const code = (await host.getByTestId('room-code').textContent())?.trim() ?? '';
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

      await guest.goto(`/?mode=join&code=${code}&lang=${language}`);
      const dialog = guest.getByRole('dialog');
      await dialog.getByLabel(t('home.pseudo')).fill('Guesty');
      await expect(dialog.getByLabel(t('home.roomCode'))).toHaveValue(code);
      await press(guest, dialog.getByRole('button', { name: t('home.join'), exact: true }), touch);

      await expect(host.getByText('Guesty')).toBeVisible({ timeout: 10_000 });
      await expect(guest.getByText('Hostess')).toBeVisible({ timeout: 10_000 });
      await press(host, host.getByRole('button', { name: t('lobby.ready'), exact: true }), touch);
      await press(guest, guest.getByRole('button', { name: t('lobby.ready'), exact: true }), touch);
      await press(host, host.getByRole('button', { name: t('lobby.start') }), touch);
      for (const page of [host, guest]) {
        await expect(page.locator('#question-title')).toBeVisible({ timeout: 20_000 });
        await expect(page.locator('#question-title')).toHaveAttribute('lang', language);
        await noHorizontalScroll(page);
      }
      await press(host, host.getByRole('button', { name: OPTION }).first(), touch);
      await press(guest, guest.getByRole('button', { name: OPTION }).nth(2), touch);
      // Reveal (2.5 s), then the article; both continue to the next question.
      for (const page of [host, guest]) {
        await expect(page.getByRole('article')).toBeVisible({ timeout: 20_000 });
        await press(page, page.getByRole('button', { name: t('common.continue') }), touch);
      }
      for (const page of [host, guest]) {
        await expect(page.getByRole('button', { name: OPTION })).toHaveCount(4, {
          timeout: 20_000,
        });
      }
      expect(problems).toEqual([]);
      await hostContext.close();
      await guestContext.close();
    });

    test('public matchmaking: two players are matched for a duel', async ({ browser }) => {
      test.setTimeout(90_000);
      const { touch, ...options } = await deviceContext(browser);
      const contexts = [await browser.newContext(options), await browser.newContext(options)];
      const pages = [await contexts[0]!.newPage(), await contexts[1]!.newPage()];
      const problems = pages.flatMap((page) => watch(page));
      const t = (key: Parameters<typeof translate>[0]) => translate(key, {}, language);
      for (const [index, page] of pages.entries()) {
        await openHome(page, language);
        await nickname(page, language, `Duel${language}${index}`, touch);
        await press(page, page.getByRole('button', { name: t('home.playOnline') }), touch);
        await press(page, page.getByRole('radio', { name: t('mode.CONTEST.desc') }), touch);
        await press(page, page.getByRole('button', { name: t('setup.startQueue') }), touch);
        if (index === 0) {
          await expect(page.getByRole('heading', { name: t('queue.searching') })).toBeVisible();
          await noHorizontalScroll(page);
        }
      }
      for (const page of pages) {
        await expect(page.locator('#question-title')).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('#question-title')).toHaveAttribute('lang', language);
      }
      for (const page of pages) {
        await press(page, page.getByRole('button', { name: OPTION }).first(), touch);
      }
      for (const page of pages) {
        await expect(page.getByRole('article')).toBeVisible({ timeout: 20_000 });
      }
      expect(problems).toEqual([]);
      for (const context of contexts) await context.close();
    });
  });
}

test('TikTok is off: no TikTok entry points, and its pages fail gracefully', async ({
  browser,
}) => {
  const { touch, ...options } = await deviceContext(browser);
  void touch;
  const context = await browser.newContext(options);
  const page = await context.newPage();
  for (const language of LANGUAGES) {
    await openHome(page, language);
    expect(await page.locator('a[href*="tiktok" i], [data-testid*="tiktok" i]').count()).toBe(0);
    // Every link on the page answers.
    const hrefs = await page
      .locator('a[href]')
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
    for (const href of new Set(hrefs)) {
      if (!href.startsWith('http')) continue;
      const response = await page.request.get(href, { maxRedirects: 5 });
      expect(response.status(), href).toBeLessThan(400);
    }
  }
  // The streamer pages explain instead of breaking.
  await page.goto('/?mode=overlay&room=ABCDEF&lang=en#token=nope');
  const en = (key: Parameters<typeof translate>[0]) => translate(key, {}, 'en');
  await expect(
    page.getByText(en('overlay.unavailable')).or(page.getByText(en('overlay.ended'))),
  ).toBeVisible({ timeout: 15_000 });
  await page.goto('/?mode=control&room=ABCDEF&lang=en#token=nope');
  await expect(
    page.getByText(en('control.unavailable')).or(page.getByText(en('control.ended'))),
  ).toBeVisible({ timeout: 15_000 });
  const health = await page.request.get('/api/health');
  expect((await health.json()).tiktok ?? 'disabled').toBe('disabled');
  const create = await page.request.post('/api/tiktok/rooms', {
    headers: { Authorization: 'Bearer anything' },
    data: { mode: 'CLASSIC' },
  });
  expect(create.status()).toBe(403);
  await context.close();
});
