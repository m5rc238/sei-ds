import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  staticDirs: [{ from: "../.sei", to: "/sei" }],
  // reactDocgen is left on (the default) because the autodocs prop tables are
  // part of what makes these stories reviewable.
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
};

export default config;