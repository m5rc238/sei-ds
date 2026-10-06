import type { Meta, StoryObj } from '@storybook/react-vite';
import { Table } from './Table';
import type { TableColumn } from './Table';

interface Experiment {
  id: string;
  name: string;
  status: string;
  owner: string;
  updated: string;
}

const rows: Experiment[] = [
  { id: '1', name: 'Brand action swap', status: 'Running', owner: 'Ada', updated: '2 hours ago' },
  { id: '2', name: 'Large radius exploration', status: 'Draft', owner: 'Lin', updated: 'Yesterday' },
  { id: '3', name: 'Tall buttons', status: 'Shipped', owner: 'Ada', updated: '3 days ago' },
];

const columns: TableColumn<Experiment>[] = [
  { key: 'name', header: 'Experiment', cell: (row) => row.name },
  { key: 'status', header: 'Status', cell: (row) => row.status },
  { key: 'owner', header: 'Owner', cell: (row) => row.owner },
  { key: 'updated', header: 'Updated', cell: (row) => row.updated },
];

const meta = {
  title: 'Components/Table',
  component: Table,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A presentational data table with real table semantics (<th scope="col">). `dense` is a density modifier; `emptyMessage` covers the empty case. No sorting or selection yet — those would be contract changes.',
      },
    },
  },
  argTypes: {
    dense: { control: 'boolean' },
    emptyMessage: { control: 'text' },
  },
  args: {
    columns,
    rows,
    rowKey: (row: Experiment) => row.id,
  },
} satisfies Meta<typeof Table<Experiment>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dense: Story = {
  args: { dense: true },
};

export const Empty: Story = {
  args: { rows: [], emptyMessage: 'No experiments yet.' },
};
