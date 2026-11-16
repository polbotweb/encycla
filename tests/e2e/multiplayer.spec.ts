import { expect, test } from '@playwright/test';

test('two players meet in a private room and see each other in the lobby', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await host.goto('/?lang=en');
  await host.getByLabel(/nickname/i).fill('Hostess');
  await host.getByRole('button', { name: /create a private room/i }).click();
  await host.getByRole('button', { name: /^create room$/i }).click();
  const code = (await host.getByTestId('room-code').textContent())?.trim() ?? '';
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

  await guest.goto(`/?mode=join&code=${code}&lang=en`);
  const dialog = guest.getByRole('dialog');
  await dialog.getByLabel(/nickname/i).fill('Guesty');
  await expect(dialog.getByLabel(/room code/i)).toHaveValue(code);
  await dialog.getByRole('button', { name: /^join$/i }).click();

  await expect(host.getByText('Guesty')).toBeVisible({ timeout: 10_000 });
  await expect(guest.getByText('Hostess')).toBeVisible({ timeout: 10_000 });

  await host.getByRole('button', { name: /^ready$/i }).click();
  await guest.getByRole('button', { name: /^ready$/i }).click();
  await host.getByRole('button', { name: /start game/i }).click();
  await expect(host.locator('#question-title')).toBeVisible({ timeout: 20_000 });
  await expect(guest.locator('#question-title')).toBeVisible({ timeout: 20_000 });
  await host.keyboard.press('KeyA');
  await guest.keyboard.press('KeyC');
  await expect(host.getByText(/Correct answer|Continue/).first()).toBeVisible({ timeout: 20_000 });

  await hostContext.close();
  await guestContext.close();
});
