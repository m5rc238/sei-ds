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
      // 'error' keeps real violations visible in CI while allowing the
      // experiment stories to run; tighten to 'error' for release gating.
      test: 'error',
    },
  },
};

export default preview;