import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * Design System / Colors Primitives
 *
 * Every raw colour primitive from the primitive layer of tokens.css, grouped
 * by ramp. Values are read at render time from the live stylesheet (the only
 * token import is in .storybook/preview.ts), so a swatch here is never a
 * hardcoded copy that can drift.
 */

type Swatch = { token: string; fallback: string };

const groups: { name: string; note: string; swatches: Swatch[] }[] = [
  {
    name: 'Neutrals',
    note: 'Surfaces, text and borders. Ordered light → dark.',
    swatches: [
      { token: '--white', fallback: '#ffffff' },
      { token: '--gray-50', fallback: '#f9fafb' },
      { token: '--gray-100', fallback: '#f3f4f6' },
      { token: '--gray-200', fallback: '#e5e7eb' },
      { token: '--gray-400', fallback: '#9ca3af' },
      { token: '--gray-500', fallback: '#6b7280' },
      { token: '--gray-700', fallback: '#374151' },
      { token: '--gray-900', fallback: '#111827' },
    ],
  },
  {
    name: 'Action blue',
    note: 'The action ramp. 600 is the AA-compliant --color-action; 700/800 step down for hover/active. 500 is the documented trap.',
    swatches: [
      { token: '--blue-500', fallback: '#3b82f6' },
      { token: '--blue-600', fallback: '#2563eb' },
      { token: '--blue-700', fallback: '#1d4ed8' },
      { token: '--blue-800', fallback: '#1e40af' },
    ],
  },
  {
    name: 'Destructive red',
    note: 'The destructive ramp. 600 is --color-destructive; 700 is hover.',
    swatches: [
      { token: '--red-50', fallback: '#fef2f2' },
      { token: '--red-600', fallback: '#dc2626' },
      { token: '--red-700', fallback: '#b91c1c' },
    ],
  },
];

function readToken(token: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value || fallback;
}

function SwatchGrid() {
  return groups.map((group) => (
    <div key={group.name} style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
        <span style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>{group.name}</span>
        <span style={{ fontSize: '14px', color: '#6b7280' }}>{group.note}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        {group.swatches.map(({ token, fallback }) => {
          const value = readToken(token, fallback);
          return (
            <div
              key={token}
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: '184px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                overflow: 'hidden',
              }}
            >
              <div style={{ height: '64px', backgroundColor: value }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '8px 10px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>{token}</span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>{value}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  ));
}

const meta = {
  title: 'Design System/Colors Primitives',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The raw colour layer of the token system. Nothing in a component may reference these directly — only the semantic layer. Values shown are read from the live stylesheet at render time.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primitives: Story = {
  render: () => <SwatchGrid />,
};