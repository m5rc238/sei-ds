import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Globals so @testing-library/react finds `afterEach` and auto-cleans the
    // DOM between tests. The tests themselves still import describe/it/expect
    // explicitly — the global flag is for integration hooks, not style.
    globals: true,
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
