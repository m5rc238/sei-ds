import type { Meta, StoryObj } from '@storybook/react-vite';
import { SettingsPanel } from './SettingsPanel';
import '../compositions.css';

/**
 * A realistic interface, not a production page. Two Cards, three Inputs and
 * Buttons in four variants — enough surface that a token change has somewhere
 * visible to land.
 */
const meta = {
  title: 'Compositions/SettingsPanel',
  component: SettingsPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Test environment for the design system. Changing a token here changes this interface because the components underneath read the same tokens as the stories.',
      },
    },
  },
} satisfies Meta<typeof SettingsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OnSurface: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div className="sei-canvas" style={{ minHeight: '100vh' }}>
      <SettingsPanel />
    </div>
  ),
};