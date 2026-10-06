import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent } from 'storybook/test';
import { DropdownMenu } from './DropdownMenu';
import { Button } from '../Button/Button';

const items = [
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'rename', label: 'Rename' },
  { value: 'export', label: 'Export as CSV' },
  { value: 'archive', label: 'Archive', disabled: true },
  { value: 'delete', label: 'Delete', disabled: true },
];

const meta = {
  title: 'Components/DropdownMenu',
  component: DropdownMenu,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Radix dropdown menu: arrows and type-ahead move [data-highlighted], Escape closes, [data-disabled] items are skipped. Sei paints the surface and the rows — see the contract for the state list.',
      },
    },
  },
  argTypes: {
    label: { control: 'text' },
  },
  args: {
    trigger: <Button variant="secondary">Actions</Button>,
    items,
    label: 'Project actions',
  },
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoLabel: Story = {
  args: { label: undefined },
};

export const OpenState: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Opens on click; ArrowDown highlights the first enabled item ([data-highlighted]), further arrows move the highlight past disabled items, Escape closes and returns focus to the trigger.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('button[data-state="closed"]');
    if (!trigger) throw new Error('menu trigger not rendered');
    await userEvent.click(trigger);
    // Radix menus do not auto-highlight on open; ArrowDown moves the
    // highlight to the first enabled item (matching the story description).
    await userEvent.keyboard('{ArrowDown}');
    if (!document.querySelector('[data-state="open"].sei-menu')) {
      throw new Error('menu did not open');
    }
    if (!document.querySelector('.sei-menu__item[data-highlighted]')) {
      throw new Error('first item not highlighted');
    }
  },
};
