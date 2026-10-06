import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent } from 'storybook/test';
import { Tooltip } from './Tooltip';
import { Button } from '../Button/Button';

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Radix tooltip: opens on hover and focus, Escape closes, aria-describedby connects trigger and content. The contract state list is empty on purpose — closed content is unmounted, not styled.',
      },
    },
  },
  args: {
    content: 'Archived projects are read-only.',
    children: <Button variant="secondary">Hover me</Button>,
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OnDisabledControl: Story = {
  // A disabled button cannot receive focus, so hover is the only way in —
  // which is exactly why wrapping disabled controls in tooltips is a trap.
  // The trigger here is a real (enabled) button with aria-disabled instead.
  args: {
    content: 'Available on the Team plan.',
    children: (
      <Button variant="secondary" aria-disabled="true">
        Team feature
      </Button>
    ),
  },
};

export const OpenState: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Opens on hover AND on focus — tab to the button to see it without a pointer. The content carries Radix’s [data-state="instant-open"|"delayed-open"] while visible.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('button');
    if (!trigger) throw new Error('tooltip trigger not rendered');
    trigger.focus();
    await userEvent.hover(trigger);
    // Portaled, like the other floating content.
    if (!document.querySelector('.sei-tooltip')) {
      throw new Error('tooltip did not open');
    }
  },
};
