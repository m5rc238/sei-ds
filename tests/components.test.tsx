/**
 * Component behavior — the parts that are ours: class composition, label and
 * description wiring, table structure. Keyboard/focus behavior of the
 * primitives (Dialog, Menu, Select, Tabs, Tooltip) belongs to the browser and
 * is exercised in e2e/, not here.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Button } from '../src/components/Button/Button';
import { Checkbox } from '../src/components/Checkbox/Checkbox';
import { Input } from '../src/components/Input/Input';
import { Table, type TableColumn } from '../src/components/Table/Table';

type Row = { id: string; name: string; status: string };

describe('Button', () => {
  it('maps variant and size to modifier classes', () => {
    render(<Button variant="destructive" size="sm">Delete</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('sei-button--destructive');
    expect(button.className).toContain('sei-button--sm');
  });

  it('defaults to type="button" so it never submits by accident', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('passes disabled through to the native element', () => {
    render(<Button disabled>Go</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('Input', () => {
  it('labels the input visibly and programmatically', () => {
    render(<Input label="Email address" />);
    const input = screen.getByLabelText('Email address');
    expect(input).toBeInTheDocument();
    // The label is a real, visible <label>, not aria-label plumbing.
    expect(screen.getByText('Email address').tagName).toBe('LABEL');
  });

  it('sets aria-invalid and points aria-describedby at the error only', () => {
    render(<Input label="Email" hint="We will write to you." error="Invalid email." />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');

    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    // The hint is hidden when the error shows — a reference to it would dangle.
    const ids = describedBy!.split(' ');
    expect(ids).toHaveLength(1);
    expect(document.getElementById(ids[0]!)).toHaveTextContent('Invalid email.');
  });

  it('references only existing ids in aria-describedby', () => {
    render(<Input label="Email" hint="A hint." />);
    const input = screen.getByLabelText('Email');
    for (const id of (input.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)) {
      expect(document.getElementById(id), `dangling aria-describedby id ${id}`).not.toBeNull();
    }
  });
});

describe('Checkbox', () => {
  it('toggles the real input when the label text is clicked', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Email notifications" />);
    const input = screen.getByLabelText('Email notifications');
    expect(input).not.toBeChecked();

    await user.click(screen.getByText('Email notifications'));
    expect(input).toBeChecked();
  });

  it('keeps disabled semantics on the native input', () => {
    render(<Checkbox label="Terms" disabled />);
    expect(screen.getByLabelText('Terms')).toBeDisabled();
  });
});

describe('Table', () => {
  const columns: TableColumn<Row>[] = [
    { key: 'name', header: 'Name', cell: (row) => row.name },
    { key: 'status', header: 'Status', cell: (row) => row.status },
  ];
  const rows: Row[] = [
    { id: '1', name: 'Experiment A', status: 'Running' },
    { id: '2', name: 'Experiment B', status: 'Draft' },
  ];

  it('renders real column headers with scope', () => {
    render(<Table columns={columns} rows={rows} rowKey={(row) => row.id} />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent)).toEqual(['Name', 'Status']);
    for (const header of headers) expect(header).toHaveAttribute('scope', 'col');
  });

  it('shows the empty message when there are no rows', () => {
    render(
      <Table columns={columns} rows={[]} rowKey={(row) => row.id} emptyMessage="Nothing yet." />,
    );
    expect(screen.getByText('Nothing yet.')).toBeInTheDocument();
  });

  it('applies the dense modifier only when dense', () => {
    const { rerender } = render(
      <Table columns={columns} rows={rows} rowKey={(row) => row.id} dense />,
    );
    expect(screen.getByRole('table').className).toContain('sei-table--dense');

    rerender(<Table columns={columns} rows={rows} rowKey={(row) => row.id} />);
    expect(screen.getByRole('table').className).not.toContain('sei-table--dense');
  });
});
