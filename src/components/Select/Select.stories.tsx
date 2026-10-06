import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent } from 'storybook/test';
import { Select } from './Select';

const options = [
  { value: 'genesis', label: 'Genesis' },
  { value: 'atlantic', label: 'Atlantic' },
  { value: 'pacific', label: 'Pacific' },
  { value: 'arctic', label: 'Arctic (coming soon)', disabled: true },
];

const meta = {
  title: 'Components/Select',
  component: Select,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Radix Select: listbox semantics, type-ahead, Escape. The trigger is a real button with a bound label; metrics derive from the input tokens so it lines up with Input. Contract states: open, highlighted, hover, disabled.',
      },
    },
  },
  argTypes: {
    disabled: { control: 'boolean' },
    label: { control: 'text' },
    placeholder: { control: 'text' },
  },
  args: {
    label: 'Region',
    placeholder: 'Choose a region…',
    options,
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSelection: Story = {
  args: { defaultValue: 'atlantic' },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const OpenState: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Opens on click: the popup carries [data-state="open"], the option under the cursor carries [data-highlighted]. Type-ahead jumps between options; Escape closes and returns focus to the trigger.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('button[data-state="closed"]');
    if (!trigger) throw new Error('select trigger not rendered');
    await userEvent.click(trigger);
    if (!document.querySelector('.sei-select__content[data-state="open"]')) {
      throw new Error('select popup did not open');
    }
    if (!document.querySelector('.sei-select__item[data-highlighted]')) {
      throw new Error('first option not highlighted');
    }
  },
};
