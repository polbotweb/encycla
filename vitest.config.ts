import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // The question bank is large (3 languages): validating it can take a few seconds on a busy CI runner.
    testTimeout: 30_000,
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['server/**/*.ts', 'shared/**/*.ts', 'client/**/*.{ts,tsx}'],
      exclude: ['server/index.ts'],
    },
  },
});
