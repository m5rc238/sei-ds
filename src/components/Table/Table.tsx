import type { ReactNode } from 'react';
import './Table.css';

export interface TableColumn<Row> {
  /** Stable key for this column. */
  key: string;
  /** Header cell content. Rendered in a real <th scope="col">. */
  header: ReactNode;
  /** Renders one cell for one row. */
  cell: (row: Row) => ReactNode;
}

export interface TableProps<Row> {
  /** Columns, in display order. */
  columns: TableColumn<Row>[];
  /** The data. */
  rows: Row[];
  /** Stable key per row — React needs it, and so does anyone diffing renders. */
  rowKey: (row: Row) => string;
  /** Reduces cell padding for dense listings. */
  dense?: boolean;
  /** Shown in a spanning cell when rows is empty. Always better than a
   * silently empty table that looks like a loading state. */
  emptyMessage?: string;
}

/**
 * A plain data table: real <table>, real <th scope="col">, real
 * <caption> — screen readers announce row/column relationships without any
 * ARIA from us. Presentational: no sorting, no selection; those change the
 * component's API and are not here yet.
 */
export function Table<Row>({ columns, rows, rowKey, dense, emptyMessage }: TableProps<Row>) {
  const classes = ['sei-table', dense ? 'sei-table--dense' : null].filter(Boolean).join(' ');

  return (
    <table className={classes}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} scope="col">
              {column.header}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td className="sei-table__empty" colSpan={columns.length}>
              {emptyMessage ?? 'No data.'}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key}>{column.cell(row)}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
