import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { translate, type MessageKey } from '../../client/i18n';
import type { Language } from '../../shared/languages';
import { E2E_ADMIN_TOKEN } from '../../playwright.config';

/**
 * TikTok mode against the built server with the simulated chat (`TIKTOK_ADAPTER=fake`): the
 * streamer console creates a room for any live, OBS shows the overlay, the control console runs
 * the game, viewers answer A/B/C/D in the chat, and the overlay shows the results.
 */

function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' && !text.includes('upload.wikimedia.org')) problems.push(text);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}

async function unlock(page: Page, language: Language): Promise<void> {
  const t = (key: MessageKey) => translate(key, {}, language);
  await page.goto(`/?mode=admin&lang=${language}`);
  await expect(page.getByRole('heading', { name: t('admin.title') })).toBeVisible();
  await page.getByLabel(t('admin.token')).fill(E2E_ADMIN_TOKEN);
  await page.getByRole('button', { name: t('admin.unlock') }).click();
  await expect(page.getByText(t('admin.simulated'))).toBeVisible();
  // A room left open by an earlier run of a reused server.
  const close = page.getByRole('button', { name: t('admin.closeRoom') });
  if (await close.isVisible()) await close.click();
  await expect(page.getByRole('button', { name: t('admin.createButton') })).toBeVisible();
}

test('streamer console, OBS overlay, control and A/B/C/D chat answers through to the results', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const t = (key: MessageKey, params: Record<string, string | number> = {}) =>
    translate(key, params, 'fr');
  const context = await browser.newContext();
  const admin = await context.newPage();
  const problems = watch(admin);

  await unlock(admin, 'fr');
  await expect(admin.getByTestId('tiktok-status')).toContainText('@encycla_demo');
  await expect(admin.getByTestId('tiktok-status')).toContainText(t('control.live'));

  // Any live: name another one; SUBJECT on the first category playable in French.
  await admin.getByLabel(t('admin.live')).fill('@Un.Autre_Live');
  await admin.getByRole('radio', { name: t('mode.SUBJECT.desc') }).check();
  const category = await admin
    .locator('#admin-category option:not([disabled]):not([value=""])')
    .first()
    .getAttribute('value');
  await admin.locator('#admin-category').selectOption(category!);
  await admin.getByLabel(t('admin.timer')).selectOption('10');
  await admin.getByRole('button', { name: t('admin.createButton') }).click();
  const code = (await admin.getByTestId('admin-room-code').textContent())!.trim();
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  const overlayUrl = await admin.getByLabel(t('admin.overlayLink')).inputValue();
  const controlUrl = await admin.getByLabel(t('admin.controlLink')).inputValue();
  expect(overlayUrl).toMatch(new RegExp(`/\\?mode=overlay&room=${code}#token=`));
  expect(controlUrl).toMatch(new RegExp(`/\\?mode=control&room=${code}#token=.+&overlay=`));
  await expect(admin.getByTestId('tiktok-status')).toContainText('@un.autre_live');

  // OBS browser source at 1920×1080, and the streamer's control console.
  const overlay = await context.newPage();
  await overlay.setViewportSize({ width: 1920, height: 1080 });
  problems.push(...watch(overlay));
  await overlay.goto(overlayUrl);
  await expect(overlay.getByText(t('overlay.join'))).toBeVisible();
  const control = await context.newPage();
  problems.push(...watch(control));
  await control.goto(controlUrl);
  await expect(control.getByRole('heading', { name: new RegExp(code) })).toBeVisible();
  await expect(control.getByText(t('control.live'))).toBeVisible();

  await control.getByRole('button', { name: t('control.start') }).click();
  await expect(overlay.getByRole('timer')).toBeVisible({ timeout: 10_000 });
  await expect(overlay.locator('ol li')).toHaveCount(4);

  // Viewers comment in the chat (simulated): A, B, C, D; chatter that is not an answer is ignored.
  // [TikTok handle, comment, name shown on stream (dots are dropped from handles)]
  const viewers = [
    ['alice_live', 'A', 'alice_live'],
    ['bruno.tv', 'b', 'brunotv'],
    ['chloe_92', 'C', 'chloe_92'],
    ['dani', 'D', 'dani'],
  ] as const;
  for (const [viewer, letter] of viewers) {
    await admin.getByLabel(t('admin.simViewer')).fill(viewer);
    await admin
      .getByRole('button', { name: t('admin.simSay', { letter: letter.toUpperCase() }) })
      .click();
    await expect(admin.getByRole('status').last()).toContainText(viewer);
  }
  const chatter = await admin.request.post('/api/admin/tiktok/chat', {
    headers: { Authorization: `Bearer ${E2E_ADMIN_TOKEN}` },
    data: { uniqueId: 'lurker', comment: 'bonjour à tous' },
  });
  expect(chatter.status()).toBe(202);
  await expect(control.getByText(t('control.viewers', { count: 4, max: 100 }))).toBeVisible();

  // The control answers for a viewer, then skips to the reveal.
  const skip = control.getByRole('button', { name: t('control.skip'), exact: true });
  await skip.click();
  await control
    .getByRole('dialog')
    .getByRole('button', { name: t('common.confirm') })
    .click();
  for (const [, , shown] of viewers) {
    await expect(overlay.getByText(shown).first()).toBeVisible({ timeout: 10_000 });
  }
  expect(
    await new AxeBuilder({ page: overlay })
      .analyze()
      .then((r) => r.violations.filter((v) => v.impact === 'critical').length),
  ).toBe(0);

  // Play the remaining questions quickly: skip each question and each article.
  const thanks = overlay.getByText(t('overlay.thanks'));
  for (let round = 0; round < 200 && !(await thanks.isVisible()); round += 1) {
    if (await skip.isEnabled()) {
      await skip.click();
      const dialog = control.getByRole('dialog');
      if (await dialog.isVisible()) {
        await dialog.getByRole('button', { name: t('common.confirm') }).click();
      }
    }
    await control.waitForTimeout(300);
  }
  await expect(thanks).toBeVisible();
  for (const [, , shown] of viewers) {
    await expect(overlay.getByText(shown).first()).toBeVisible();
  }

  // The streamer closes the room from the console; the slot is free again.
  await admin.getByRole('button', { name: t('admin.refresh') }).click();
  await admin.getByRole('button', { name: t('admin.closeRoom') }).click();
  await expect(admin.getByRole('button', { name: t('admin.createButton') })).toBeVisible();
  expect(problems).toEqual([]);
  await context.close();
});

for (const language of ['en', 'ar'] as const) {
  test(`streamer console in ${language}: direction, labels and accessibility`, async ({ page }) => {
    const problems = watch(page);
    await unlock(page, language);
    await expect(page.locator('html')).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id}: ${v.help}`),
    ).toEqual([]);
    expect(problems).toEqual([]);
  });
}

test('the streamer console refuses a wrong admin token', async ({ page }) => {
  await page.goto('/?mode=admin&lang=en');
  await page.getByLabel('Admin token').fill('wrong-token');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByText('Admin token refused.')).toBeVisible();
});
