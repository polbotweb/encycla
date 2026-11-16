import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('home page loads without console errors and has no serious a11y violations', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('upload.wikimedia.org')) {
      errors.push(message.text());
    }
  });
  await page.goto('/?lang=en');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  expect(errors).toEqual([]);
});

test('solo classic: first question can be answered with the keyboard and an article follows', async ({
  page,
}) => {
  await page.goto('/?lang=en');
  await page.getByLabel(/nickname/i).fill('Alice');
  await page.getByRole('button', { name: /solo classic/i }).click();
  await page.getByRole('button', { name: /^start/i }).click();
  await expect(page.locator('#question-title')).toBeVisible({ timeout: 15_000 });
  const questionScan = await new AxeBuilder({ page }).analyze();
  expect(
    questionScan.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id}: ${v.help}`),
  ).toEqual([]);
  await page.keyboard.press('KeyB');
  await expect(page.getByText(/Continue/)).toBeVisible({ timeout: 15_000 });
  const articleScan = await new AxeBuilder({ page }).analyze();
  expect(
    articleScan.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id}: ${v.help}`),
  ).toEqual([]);
});
