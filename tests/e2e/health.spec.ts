import { expect, test } from '@playwright/test';

test('health endpoint responds and strict security headers are present', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { version: string };
  expect(body.version).toBe('1.0.0');
  const csp = response.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("default-src 'self'");
  expect(csp).not.toContain('unsafe-inline');
  expect(csp).not.toContain('unsafe-eval');
});

test('hashed assets are served precompressed and cached immutably', async ({ page, request }) => {
  await page.goto('/?lang=en');
  const script = await page.locator('script[type="module"][src^="/assets/"]').getAttribute('src');
  expect(script).toBeTruthy();
  const response = await request.get(script as string, { headers: { 'accept-encoding': 'br' } });
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-encoding']).toBe('br');
  expect(response.headers()['cache-control']).toContain('immutable');
  expect(response.headers()['content-type']).toContain('javascript');
});

test('streamer screens load their split chunk under the CSP', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?mode=overlay&room=ABCDEF&lang=en');
  await expect(page.getByText('Overlay unavailable')).toBeVisible();
  await page.goto('/?mode=control&room=ABCDEF&lang=en');
  await expect(page.getByText('Control unavailable. Check the link and token.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the web manifest, icon and social meta are served', async ({ page, request }) => {
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  expect(manifest.headers()['content-type']).toContain('manifest+json');
  const body = (await manifest.json()) as { name: string; icons: { src: string }[] };
  expect(body.name).toBe('Encycla MindMaze');
  const icon = await request.get(body.icons[0]?.src ?? '');
  expect(icon.headers()['content-type']).toContain('image/svg+xml');
  for (const entry of body.icons) expect((await request.get(entry.src)).ok(), entry.src).toBe(true);
  const preview = await request.get('/og/encycla-fr.png');
  expect(preview.headers()['content-type']).toContain('image/png');
  expect((await request.get('/robots.txt')).ok()).toBe(true);
  await page.goto('/');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'Encycla MindMaze',
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    /\/og\/encycla-fr\.png$/,
  );
  await expect(page.getByTestId('logo-wordmark')).toBeVisible();
});
