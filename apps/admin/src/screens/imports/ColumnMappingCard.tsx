import { t, type ColumnMapping } from '@guaranix/shared';
import { Card, Eyebrow, SelectField } from '@guaranix/ui';
import type { SpreadsheetSheet } from './read-spreadsheet';

export interface ColumnMappingCardProps<Field extends string> {
  title: string;
  hint: string;
  sheet: SpreadsheetSheet;
  fields: readonly Field[];
  labelOf: (field: Field) => string;
  mapping: ColumnMapping<Field>;
  onChange: (mapping: ColumnMapping<Field>) => void;
}

const IGNORE = '';

/** One select per spreadsheet column, with the first value as a hint of what it holds. */
export function ColumnMappingCard<Field extends string>({
  title,
  hint,
  sheet,
  fields,
  labelOf,
  mapping,
  onChange,
}: ColumnMappingCardProps<Field>) {
  const headers = sheet.rows[0] ?? [];
  const sampleOf = (column: number) =>
    sheet.rows.slice(1).find((row) => row[column])?.[column] ?? null;

  const choose = (column: number, value: string) => {
    const field = value === IGNORE ? null : (value as Field);
    // A field feeds from one column only: picking it here frees it elsewhere.
    onChange(
      mapping.map((current, index) =>
        index === column ? field : current === field ? null : current,
      ),
    );
  };

  return (
    <Card>
      <div className="flex flex-col gap-1">
        <Eyebrow>{title}</Eyebrow>
        <p className="text-sm text-text-secondary">{hint}</p>
      </div>
      <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
        {headers.map((header, column) => {
          const sample = sampleOf(column);
          return (
            <li key={`${column}-${header}`} className="flex flex-col gap-1">
              <SelectField
                label={header || `#${column + 1}`}
                value={mapping[column] ?? IGNORE}
                onChange={(event) => choose(column, event.target.value)}
              >
                <option value={IGNORE}>{t('admin.imports.mapping.ignore')}</option>
                {fields.map((field) => (
                  <option key={field} value={field}>
                    {labelOf(field)}
                  </option>
                ))}
              </SelectField>
              <span className="truncate text-xs text-text-secondary">
                {sample
                  ? t('admin.imports.mapping.sample', { value: sample })
                  : t('admin.imports.mapping.noSample')}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
