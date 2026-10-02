import type { Meta, StoryObj } from '@storybook/react-vite';
import { ExplorerStoryWrapper } from './ExplorerStoryWrapper';

const meta = {
  title: 'Design System/Explorer',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Explorer: Story = {
  render: () => <ExplorerStoryWrapper />,
};
