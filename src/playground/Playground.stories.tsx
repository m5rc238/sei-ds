import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { SettingsPanel } from '../compositions/SettingsPanel';
import { AccountForm } from '../compositions/AccountForm';
import { StyleProvider } from './StyleProvider';
import '../compositions/compositions.css';

/**
 * Design System / Playground
 *
 * Renders the REAL compositions — not a mock — inside a StyleProvider whose
 * custom-property overrides come from the controls below. Change a control and
 * the same components used by the stories and the compositions respond.
 *
 * The controls are grouped by the decision they represent, and each one names
 * the token it writes to, so it is always clear what was changed.
 */

type Controls = {
  buttonHeightMd: string;
  buttonRadius: string;
  buttonPaddingXMd: string;
  cardRadius: string;
  cardPadding: string;
  fontSizeMd: string;
  colorAction: string;
  colorDestructive: string;
  colorSurface: string;
  radiusMd: string;
};

const meta = {
  title: 'Design System/Playground',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Live control over the decisions that span the whole system. Each control writes a CSS custom property; the components underneath are the real components.',
      },
    },
  },
  argTypes: {
    buttonHeightMd: {
      control: { type: 'text' },
      description: '--button-height-md (Experiment A)',
      table: { category: 'Button' },
    },
    buttonRadius: {
      control: { type: 'text' },
      description: '--button-radius (Experiment B)',
      table: { category: 'Button' },
    },
    buttonPaddingXMd: {
      control: { type: 'text' },
      description: '--button-padding-x-md',
      table: { category: 'Button' },
    },
    cardRadius: {
      control: { type: 'text' },
      description: '--card-radius',
      table: { category: 'Card' },
    },
    cardPadding: {
      control: { type: 'text' },
      description: '--card-padding',
      table: { category: 'Card' },
    },
    fontSizeMd: {
      control: { type: 'text' },
      description: '--font-size-md — a primitive, so it moves type everywhere',
      table: { category: 'Typography' },
    },
    colorAction: {
      control: { type: 'color' },
      description: '--color-action (Experiment C)',
      table: { category: 'Colour' },
    },
    colorDestructive: {
      control: { type: 'color' },
      description: '--color-destructive',
      table: { category: 'Colour' },
    },
    colorSurface: {
      control: { type: 'color' },
      description: '--color-surface',
      table: { category: 'Colour' },
    },
    radiusMd: {
      control: { type: 'text' },
      description: '--radius-md — the primitive that --button-radius and --input-radius derive from',
      table: { category: 'Radius' },
    },
  },
  args: {
    buttonHeightMd: '40px',
    buttonRadius: 'var(--radius-md)',
    buttonPaddingXMd: 'var(--space-4)',
    cardRadius: 'var(--radius-lg)',
    cardPadding: 'var(--space-6)',
    fontSizeMd: '16px',
    colorAction: '#2563eb',
    colorDestructive: '#dc2626',
    colorSurface: '#ffffff',
    radiusMd: '8px',
  },
  render: (args: Controls) => {
    const overrides: Record<string, string> = {
      '--button-height-md': args.buttonHeightMd,
      '--button-radius': args.buttonRadius,
      '--button-padding-x-md': args.buttonPaddingXMd,
      '--card-radius': args.cardRadius,
      '--card-padding': args.cardPadding,
      '--font-size-md': args.fontSizeMd,
      '--color-action': args.colorAction,
      '--color-destructive': args.colorDestructive,
      '--color-surface': args.colorSurface,
      '--radius-md': args.radiusMd,
    };

    return (
      <StyleProvider values={overrides} className="sei-canvas">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--stack-gap)' }}>
          {/* Shared context: shows how one decision lands across components. */}
          <Card title="Shared context" description="One change, every consumer of that token.">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' }}>
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="primary" size="sm">
                Small
              </Button>
              <Button variant="primary" size="lg">
                Large
              </Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
            </div>
            <Input label="Field label" placeholder="Placeholder" hint="Helper text." />
          </Card>

          {/* The real compositions, unmodified. */}
          <div className="sei-canvas__grid">
            <SettingsPanel />
            <AccountForm />
          </div>
        </div>
      </StyleProvider>
    );
  },
} satisfies Meta<Controls>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const TallButtons: Story = {
  args: {
    buttonHeightMd: '48px',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Experiment A, applied through a control: --button-height-md at 48px. Every Button in the components above and the two compositions below changes together.',
      },
    },
  },
};

export const LargeRadius: Story = {
  args: {
    radiusMd: '12px',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Experiment B, applied through a control: --radius-md at 12px. Buttons and Inputs change (they derive from it); Cards do not, because --card-radius derives from --radius-lg.',
      },
    },
  },
};

export const BrandAction: Story = {
  args: {
    colorAction: '#7c3aed',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Experiment C, applied through a control: --color-action changed. Every primary Button in the compositions updates; destructive Buttons do not, because they use a different semantic role.',
      },
    },
  },
};