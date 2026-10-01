import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './Input';

const meta = {
  title: 'Components/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A labelled native <input>. The label is always rendered and always associated — placeholder text is never used as the label.',
      },
    },
  },
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    error: { control: 'text' },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
  },
  args: {
    label: 'Email address',
    placeholder: 'ada@example.com',
    hint: 'We will send a confirmation to this address.',
    disabled: false,
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithError: Story = {
  args: { error: 'Enter a valid email address.' },
  parameters: {
    docs: {
      description: {
        story:
          'An error sets aria-invalid and is associated with the input via aria-describedby. The message replaces the hint so the two do not compete.',
      },
    },
  },
};

export const WithoutHint: Story = {
  args: { hint: '' },
};

export const Filled: Story = {
  args: { defaultValue: 'ada@example.com' },
};

export const Disabled: Story = {
  args: { disabled: true },
};