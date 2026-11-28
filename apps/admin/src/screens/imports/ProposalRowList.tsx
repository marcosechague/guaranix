import { t } from '@guaranix/shared';
import { Card, DividedList, Eyebrow, IconButton } from '@guaranix/ui';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ProposalRowSheet } from './ProposalRowSheet';

export interface ProposalRowListProps<Field extends string> {
  title: string;
  fields: readonly Field[];
  labelOf: (field: Field) => string;
  /** The row's main text, e.g. the member's name. */
  titleOf: (cells: Partial<Record<Field, string>>) => string;
  /** Fields `titleOf` already shows, left out of the details line. */
  titleFields: readonly Field[];
  /** Data rows, one cell per field, in `fields` order. */
  rows: string[][];
  onChange: (rows: string[][]) => void;
}

const cellsOf = <Field extends string>(fields: readonly Field[], cells: string[]) =>
  Object.fromEntries(fields.map((field, column) => [field, cells[column] ?? ''])) as Partial<
    Record<Field, string>
  >;

/** What AI proposed, row by row, so the admin can fix or drop each one before the review. */
export function ProposalRowList<Field extends string>({
  title,
  fields,
  labelOf,
  titleOf,
  titleFields,
  rows,
  onChange,
}: ProposalRowListProps<Field>) {
  const [editing, setEditing] = useState<number | null>(null);
  const editingCells = editing === null ? undefined : rows[editing];

  return (
    <Card>
      <Eyebrow>{title}</Eyebrow>
      <DividedList>
        {rows.map((cells, index) => {
          const row = index + 1;
          const values = cellsOf(fields, cells);
          const details = fields
            .filter((field) => values[field] && !titleFields.includes(field))
            .map((field) => `${labelOf(field)}: ${values[field]}`);
          return (
            <li key={index} className="flex items-start gap-3 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm text-text-secondary tabular-nums">
                    {t('admin.imports.ai.row', { row })}
                  </span>
                  <span className="font-semibold">
                    {titleOf(values) || t('admin.imports.preview.noName')}
                  </span>
                </div>
                {details.length > 0 ? (
                  <p className="text-sm break-words text-text-soft">{details.join(' · ')}</p>
                ) : null}
              </div>
              <IconButton
                variant="outline"
                label={t('admin.imports.ai.edit', { row })}
                onClick={() => setEditing(index)}
              >
                <Pencil aria-hidden="true" size={18} />
              </IconButton>
              <IconButton
                variant="outline"
                label={t('admin.imports.ai.remove', { row })}
                onClick={() => onChange(rows.filter((_, other) => other !== index))}
              >
                <Trash2 aria-hidden="true" size={18} />
              </IconButton>
            </li>
          );
        })}
      </DividedList>
      {editing !== null && editingCells ? (
        <ProposalRowSheet
          row={editing + 1}
          fields={fields}
          labelOf={labelOf}
          cells={editingCells}
          onClose={() => setEditing(null)}
          onSave={(cells) => {
            onChange(rows.map((other, index) => (index === editing ? cells : other)));
            setEditing(null);
          }}
        />
      ) : null}
    </Card>
  );
}
