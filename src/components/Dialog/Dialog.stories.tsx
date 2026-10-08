import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent } from 'storybook/test';
import { Dialog } from './Dialog';
import { Button } from '../Button/Button';

const meta = {
  title: 'Components/Dialog',
  component: Dialog,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Radix Dialog: focus is trapped, Escape closes, focus returns to the trigger. The single styled state is `open` — closed content is unmounted, not styled. See Dialog.css for the overlay/panel layering.',
      },
    },
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
  },
  args: {
    title: 'Delete this project?',
    description: 'The project and all of its experiments will be removed. This cannot be undone.',
    trigger: <Button variant="destructive">Delete project</Button>,
    children: (
      <p>
        Deleting removes every experiment, token override and report that belongs to this project.
      </p>
    ),
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutDescription: Story = {
  args: {
    title: 'Rename project',
    description: undefined,
    trigger: <Button variant="secondary">Rename</Button>,
    children: <p>Type the new name in the field that appears after confirming.</p>,
  },
};

export const OpenState: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Opens from the trigger so the open state ([data-state="open"]) is inspectable. Tab is trapped inside the panel, Escape closes it and focus returns to the trigger.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('button[data-state="closed"]');
    if (!trigger) throw new Error('dialog trigger not rendered');
    await userEvent.click(trigger);
    // Radix portals the panel to document.body, outside the story root.
    if (!document.querySelector('.sei-dialog[data-state="open"]')) {
      throw new Error('dialog did not open');
    }
  },
};
