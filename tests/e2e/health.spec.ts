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
