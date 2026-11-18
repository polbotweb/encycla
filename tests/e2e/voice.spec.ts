import { expect, test, type Page } from '@playwright/test';
import { translate, type MessageKey } from '../../client/i18n';
import type { Language } from '../../shared/languages';
import { installFakeSpeech, spoken } from './fakeSpeech';

/** Automatic voice (D-115): off by default for players, header toggle, reading, Arabic notice. */

async function startSolo(page: Page, language: Language): Promise<void> {
  const t = (key: MessageKey) => translate(key, {}, language);
  await page.getByLabel(t('home.pseudo')).fill('Alice');
  await page.getByRole('button', { name: t('home.soloClassic') }).click();
  await page.getByRole('button', { name: t('setup.startSolo') }).click();
  await expect(page.locator('#question-title')).toBeVisible({ timeout: 15_000 });
}

test('players: the voice is off by default, the header toggle turns it on and it reads the game', async ({
  page,
}) => {
  await installFakeSpeech(page);
  await page.goto('/?lang=en');
  const toggle = page.getByTestId('voice-toggle');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('voice-suggestion')).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('voice-suggestion')).toBeHidden();
  await page.reload();
  await expect(page.getByTestId('voice-toggle')).toHaveAttribute('aria-pressed', 'true');

  await startSolo(page, 'en');
  const question = (await page.locator('#question-title').innerText()).trim();
  await expect
    .poll(async () =>
      (await spoken(page)).some(
        (entry) => /^Question 1 of \d+\. /.test(entry.text) && entry.text.endsWith(question),
      ),
    )
    .toBe(true);
  const lines = (await spoken(page)).map((entry) => entry.text);
  for (const letter of ['A', 'B', 'C', 'D']) {
    expect(lines.some((line) => line.startsWith(`${letter}:`))).toBe(true);
  }
  await page.keyboard.press('KeyB');
  await expect
    .poll(async () => (await spoken(page)).some((entry) => entry.text.startsWith('The answer is')))
    .toBe(true);

  // Turned off: nothing more is read.
  const before = (await spoken(page)).length;
  await page.getByTestId('voice-toggle').click();
  await expect(page.getByTestId('voice-toggle')).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(500);
  expect((await spoken(page)).length).toBe(before);
});

test('Arabic questions without an Arabic voice: a notice, never another voice', async ({
  page,
}) => {
  await installFakeSpeech(page);
  await page.goto('/?lang=ar&voice=1');
  await startSolo(page, 'ar');
  await expect(page.getByTestId('voice-missing')).toBeVisible();
  expect((await spoken(page)).filter((entry) => !entry.lang.startsWith('ar'))).toEqual([]);
});

test('the settings panel: voice, speed and volume are kept after a reload', async ({ page }) => {
  await installFakeSpeech(page);
  await page.goto('/?lang=en');
  await page.getByTestId('voice-details').locator('summary').click();
  const panel = page.getByTestId('voice-settings');
  await panel.getByRole('switch').check();
  await panel.getByLabel(/Voice \(English\)/).selectOption('fake-en-US');
  await panel.getByLabel(/Speed/).fill('1.5');
  await panel.getByRole('button', { name: 'Test the voice' }).click();
  await expect
    .poll(async () => (await spoken(page)).map((entry) => entry.text))
    .toContain('Hello! This voice will read the questions.');
  await page.reload();
  await page.getByTestId('voice-details').locator('summary').click();
  await expect(page.getByTestId('voice-settings').getByRole('switch')).toBeChecked();
  await expect(page.getByTestId('voice-settings').getByLabel(/Speed/)).toHaveValue('1.5');
});
