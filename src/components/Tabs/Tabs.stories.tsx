import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent } from 'storybook/test';
import { Tabs } from './Tabs';

const items = [
  {
    value: 'general',
    label: 'General',
    content: <p>Profile name, email and language settings live here.</p>,
  },
  {
    value: 'security',
    label: 'Security',
    content: <p>Password, two-factor authentication and active sessions.</p>,
  },
  {
    value: 'billing',
    label: 'Billing',
    content: <p>Invoices, payment methods and plan changes.</p>,
  },
];

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Radix Tabs: arrow keys move between tabs, each trigger is wired to its panel. The active indicator is the [data-state="active"] border — see the contract for the state list.',
      },
    },
  },
  argTypes: {
    label: { control: 'text' },
  },
  args: {
    items,
    label: 'Settings',
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SecondTabActive: Story = {
  args: { defaultValue: 'security' },
};

export const KeyboardNavigation: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Focus a tab and use ArrowLeft/ArrowRight to move selection, Home/End to jump to the ends. Disabled tabs are skipped by the roving focus.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const first = canvasElement.querySelector<HTMLButtonElement>('[role="tab"]');
    if (!first) throw new Error('no tab trigger rendered');
    first.focus();
    await userEvent.keyboard('{ArrowRight}');
  },
  args: {
    items: [...items.slice(0, 2), { ...items[2]!, disabled: true }],
  },
};
