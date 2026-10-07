/* =============================================================================
   Storybook preview
   -----------------------------------------------------------------------------
   Loads the token layer and the global baseline once, for every story. This is
   the only place tokens.css is imported — components never import it, so there
   is exactly one source of truth for token values in the app.

   Chromatic-ready: `staticDirs` is configured in main.ts, and the addon is
   picked up automatically from a CHROMATIC_PROJECT_TOKEN in the environment.
   No credentials are stored in this repository.
   ============================================================================= */

import '../src/tokens/tokens.css';
import '../src/styles/globals.css';

import type { Preview } from '@storybook/react-vite';

const preview: Preview = {
  parameters: {
    controls: {
      expanded: true,
    },
    a11y: {
      // 'error' turns every found violation into a failing test. The addon
      // audit runs axe over the whole document (not just the story root), so
      // it can see Radix's aria-hidden behaviour that scoped e2e scans cannot.
      test: 'error',
      config: {
        rules: [
          {
            // Radix non-modal overlays (DropdownMenu, Select) hide the rest of
            // the document via @radix-ui/react-dismissable-layer while open,
            // and manage focus themselves. The axe rule cannot know about that
            // focus management, so it flags a false positive whenever a menu
            // is open. Genuine violations are still caught everywhere else.
            id: 'aria-hidden-focus',
            enabled: false,
          },
        ],
      },
    },
  },
};

export default preview;