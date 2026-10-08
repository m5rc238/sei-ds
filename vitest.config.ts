import { defineConfig } from 'vitest/config';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    // Shared globals inherited by both projects: @testing-library/react needs
    // a global `afterEach` to auto-clean the DOM between tests. The tests
    // themselves still import describe/it/expect explicitly.
    globals: true,
    projects: [
      {
        // jsdom suite: component behaviour. Vitest 5 runs a file only when a
        // project matches its include, so the unit project declares this
        // explicitly.
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          setupFiles: ['tests/setup.ts'],
          include: ['tests/**/*.test.{ts,tsx}'],
        },
      },
      {
        // Storybook component tests: every story with a play function runs as
        // a browser test via @storybook/addon-vitest (configDir is resolved
        // against process.cwd(), which is the repo root).
        extends: true,
        plugins: [storybookTest({ configDir: '.storybook' })],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});