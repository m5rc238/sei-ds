import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from './Checkbox';

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A native <input type="checkbox"> painted in place. Checked semantics, keyboard toggling and disabled come from the platform. States come from CSS; there are no variant axes — see the contract.',
      },
    },
  },
  argTypes: {
    disabled: { control: 'boolean' },
    checked: { control: 'boolean' },
  },
  args: {
    label: 'Email notifications',
    disabled: false,
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {};

export const Checked: Story = {
  args: { defaultChecked: true },
};

export const Disabled: Story = {
  args: { disabled: true, defaultChecked: true },
};

export const States: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Hover and focus are CSS states and are not reachable as Storybook args. Tab through the row to see the focus ring; hover the boxes to see the border response.',
      },
    },
  },
  render: (args) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
      <Checkbox {...args} />
      <Checkbox {...args} defaultChecked />
      <Checkbox {...args} disabled />
      <Checkbox {...args} disabled defaultChecked />
    </div>
  ),
};
