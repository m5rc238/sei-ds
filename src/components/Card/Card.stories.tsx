import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from './Card';
import { Button } from '../Button';
import { Input } from '../Input';

const meta = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A surface with an optional title, description, body and footer. Card owns no state; it is a layout role made of tokens.',
      },
    },
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    bare: { control: 'boolean' },
  },
  args: {
    title: 'Profile',
    description: 'This information is visible to people in your workspace.',
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Card {...args}>
      <Input label="Display name" placeholder="Ada Lovelace" />
    </Card>
  ),
};

export const WithFooter: Story = {
  render: (args) => (
    <Card
      {...args}
      footer={
        <>
          <Button variant="primary">Save changes</Button>
          <Button variant="ghost">Cancel</Button>
        </>
      }
    >
      <Input label="Display name" placeholder="Ada Lovelace" />
    </Card>
  ),
};

export const BodyOnly: Story = {
  args: { title: undefined, description: undefined },
  render: (args) => (
    <Card {...args}>
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
        A card with no header, used when the surrounding context already says what this is.
      </p>
    </Card>
  ),
};

export const DestructiveContent: Story = {
  args: {
    title: 'Danger zone',
    description: 'Deleting your account removes all of your data. This cannot be undone.',
  },
  render: (args) => (
    <Card {...args} footer={<Button variant="destructive">Delete account</Button>}>
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
        This action is permanent.
      </p>
    </Card>
  ),
};