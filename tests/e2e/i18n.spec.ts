import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { translate } from '../../client/i18n';
import type { Language } from '../../shared/languages';

const ARABIC = /[\u0600-\u06FF]/;

async function seriousViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help}`);
}

async function html(page: Page): Promise<{ lang: string; dir: string }> {
  return page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
  }));
}

async function startSolo(page: Page, language: Language, questionLanguage?: Language) {
  await page.getByLabel(translate('home.pseudo', {}, language)).fill('Alice');
  await page.getByRole('button', { name: translate('home.soloClassic', {}, language) }).click();
  if (questionLanguage) await page.locator('#question-language').selectOption(questionLanguage);
  await page.getByRole('button', { name: translate('setup.startSolo', {}, language) }).click();
  await expect(page.locator('#question-title')).toBeVisible({ timeout: 15_000 });
}

test('French is the default language and the choice survives a reload', async ({ page }) => {
  await page.goto('/');
  expect(await html(page)).toEqual({ lang: 'fr', dir: 'ltr' });
  await expect(page.getByRole('button', { name: /solo classique/i })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  await page.getByTestId('language-switcher').selectOption('en');
  expect(await html(page)).toEqual({ lang: 'en', dir: 'ltr' });
  await expect(page.getByRole('button', { name: /solo classic$/i })).toBeVisible();
  expect(page.url()).toContain('lang=en');
  expect(await page.evaluate(() => localStorage.getItem('encycla.lang.v1'))).toBe('en');

  // No ?lang= any more: the saved choice is used.
  await page.goto('/');
  expect(await html(page)).toEqual({ lang: 'en', dir: 'ltr' });

  // ?lang= wins over the saved choice.
  await page.goto('/?lang=ar');
  expect(await html(page)).toEqual({ lang: 'ar', dir: 'rtl' });
});

test('Arabic switches the whole page to RTL, mirrors the layout and passes axe', async ({
  page,
}) => {
  await page.goto('/?lang=en');
  const brand = page.getByRole('button', { name: translate('app.homeAria', {}, 'en') });
  const switcher = page.getByTestId('language-switcher');
  const ltrBrand = await brand.boundingBox();
  const ltrSwitcher = await switcher.boundingBox();
  expect(ltrBrand!.x).toBeLessThan(ltrSwitcher!.x);

  await switcher.selectOption('ar');
  expect(await html(page)).toEqual({ lang: 'ar', dir: 'rtl' });
  await expect(page.getByLabel(translate('home.pseudo', {}, 'ar'))).toBeVisible();
  expect(await page.title()).toBe(translate('app.documentTitle', {}, 'ar'));
  const rtlBrand = await page
    .getByRole('button', { name: translate('app.homeAria', {}, 'ar') })
    .boundingBox();
  const rtlSwitcher = await switcher.boundingBox();
  expect(rtlBrand!.x).toBeGreaterThan(rtlSwitcher!.x);

  const body = await page.locator('main').innerText();
  expect(body).toMatch(ARABIC);
  expect(await seriousViolations(page)).toEqual([]);
});

test('no horizontal scrolling on a phone in French, English and Arabic', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  for (const language of ['fr', 'en', 'ar'] as const) {
    await page.goto(`/?lang=${language}`);
    await expect(page.getByTestId('language-switcher')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, language).toBeLessThanOrEqual(0);
  }
});

test('an Arabic solo game: the question, the answer and the article are in Arabic and RTL', async ({
  page,
}) => {
  await page.goto('/?lang=ar');
  await startSolo(page, 'ar');

  const title = page.locator('#question-title');
  await expect(title).toHaveAttribute('lang', 'ar');
  await expect(title).toHaveAttribute('dir', 'rtl');
  expect(await title.innerText()).toMatch(ARABIC);
  const options = page.getByRole('button', { name: /^[A-D] / });
  await expect(options).toHaveCount(4);
  const labels = await options.allInnerTexts();
  expect(labels.filter((label) => ARABIC.test(label)).length).toBeGreaterThanOrEqual(3);
  expect(await seriousViolations(page)).toEqual([]);

  await page.keyboard.press('KeyB');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
  const article = page.locator('[lang="ar"][dir="rtl"]').first();
  await expect(article).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test('questions follow the room language, not the interface language', async ({ page }) => {
  await page.goto('/?lang=fr');
  await startSolo(page, 'fr', 'en');
  const title = page.locator('#question-title');
  await expect(title).toHaveAttribute('lang', 'en');
  await expect(title).toHaveAttribute('dir', 'ltr');
  expect(await html(page)).toEqual({ lang: 'fr', dir: 'ltr' });
  expect(await title.innerText()).not.toMatch(ARABIC);
});
