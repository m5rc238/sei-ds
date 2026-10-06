import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { buttonContract } from '../../contracts/button.contract';

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A native <button>. Variants carry meaning, sizes carry scale, states come from CSS. Every visual value is a token reference — see Button.css. Control options are read from the Button contract.',
      },
    },
  },
  argTypes: {
    variant: { control: 'select', options: buttonContract.props.variant },
    size: { control: 'select', options: buttonContract.props.size },
    disabled: { control: 'boolean' },
  },
  args: {
    children: 'Button',
    variant: 'primary',
    size: 'md',
    disabled: false,
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: { variant: 'secondary' },
};

export const Destructive: Story = {
  args: { variant: 'destructive' },
  parameters: {
    docs: {
      description: {
        story:
          'For irreversible actions. Uses the --color-destructive role, which is independent of --color-action — changing the action colour never moves a destructive button.',
      },
    },
  },
};

export const Ghost: Story = {
  args: { variant: 'ghost' },
};

export const Sizes: Story = {
  args: { children: 'Save changes' },
  render: (args) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <Button {...args} size="sm" />
      <Button {...args} size="md" />
      <Button {...args} size="lg" />
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const AllVariants: Story = {
  args: { children: 'Save changes' },
  render: (args) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
      <Button {...args} variant="primary" />
      <Button {...args} variant="secondary" />
      <Button {...args} variant="destructive" />
      <Button {...args} variant="ghost" />
    </div>
  ),
};

export const States: Story = {
  args: { children: 'Save changes' },
  parameters: {
    docs: {
      description: {
        story:
          'Hover, focus and active are CSS states and are not reachable as Storybook args. Tab to the buttons below to see the focus ring; hover or press to see the rest.',
      },
    },
  },
  render: (args) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
      <Button {...args} variant="primary" />
      <Button {...args} variant="primary" disabled />
      <Button {...args} variant="secondary" />
      <Button {...args} variant="secondary" disabled />
      <Button {...args} variant="destructive" />
      <Button {...args} variant="destructive" disabled />
    </div>
  ),
};