import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['server/**/*.ts', 'shared/**/*.ts', 'client/**/*.{ts,tsx}'],
      exclude: ['server/index.ts'],
    },
  },
});
