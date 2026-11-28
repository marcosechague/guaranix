import type { ReactNode } from 'react';
import { classNames } from '../lib/class-names';

export interface DataColumn<Row> {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  align?: 'start' | 'end';
  /** The row's title on phones, where each row becomes a card. */
  primary?: boolean;
  /** Shown on phones under the title without its header (status badges, actions). */
  bare?: boolean;
}

export interface DataTableProps<Row> {
  /** Read by screen readers; tables need a name. */
  caption: string;
  columns: readonly DataColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  className?: string;
}

/**
 * A table on tablets and desktops that turns into stacked cards on phones,
 * so wide lists (boxes, members) never scroll sideways in a 390 px screen.
 */
export function DataTable<Row>({ caption, columns, rows, rowKey, className }: DataTableProps<Row>) {
  const primary = columns.find((column) => column.primary) ?? columns[0];
  const details = columns.filter((column) => column !== primary && !column.bare);
  const bare = columns.filter((column) => column !== primary && column.bare);
  return (
    <div className={className}>
      <table className="hidden w-full border-collapse text-sm md:table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-left text-xs text-text-secondary">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={classNames(
                  'px-3 pb-2 font-semibold first:pl-0 last:pr-0',
                  column.align === 'end' ? 'text-right' : '',
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-t border-divider">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={classNames(
                    'px-3 py-3 align-middle text-text-soft first:pl-0 last:pr-0',
                    column.primary ? 'font-semibold text-text' : '',
                    column.align === 'end' ? 'text-right whitespace-nowrap' : '',
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <ul aria-label={caption} className="flex flex-col divide-y divide-divider md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="font-semibold text-text">{primary?.cell(row)}</div>
              {bare[0] ? <div className="shrink-0">{bare[0].cell(row)}</div> : null}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {details.map((column) => (
                <div key={column.key} className="flex flex-col">
                  <dt className="text-xs text-text-secondary">{column.header}</dt>
                  <dd className="text-text-soft">{column.cell(row)}</dd>
                </div>
              ))}
            </dl>
            {bare.slice(1).map((column) => (
              <div key={column.key}>{column.cell(row)}</div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
