import type { Meta, StoryObj } from '@storybook/react-vite';
import { AccountForm } from './AccountForm';
import '../compositions.css';

/**
 * A realistic interface, not a production page. Deliberately includes the
 * states worth inspecting: an invalid-email error, a disabled submit, and a
 * destructive action that needs a second, explicit click.
 */
const meta = {
  title: 'Compositions/AccountForm',
  component: AccountForm,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Test environment for the design system. Type an invalid email to see the error role; the submit button enables only when the form is valid.',
      },
    },
  },
} satisfies Meta<typeof AccountForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OnSurface: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div className="sei-canvas" style={{ minHeight: '100vh' }}>
      <AccountForm />
    </div>
  ),
};