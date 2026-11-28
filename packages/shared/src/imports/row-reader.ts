import type { CellResult } from './cells';
import type { ImportIssue } from './fields';
import { cleanCell } from './text';

/**
 * Reads the cells of one row, collecting an issue per unreadable cell instead
 * of stopping at the first one, so the preview can show everything to fix.
 */
export class RowReader<Field extends string> {
  readonly errors: ImportIssue[] = [];
  readonly warnings: ImportIssue[] = [];

  constructor(private readonly row: Partial<Record<Field, string>>) {}

  text(field: Field, maxLength = 120): string | null {
    const value = cleanCell(this.row[field]);
    if (value !== null && value.length > maxLength) {
      this.error(field, 'too_long');
      return null;
    }
    return value;
  }

  parsed<T>(field: Field, parse: (text: string) => CellResult<T>): T | null {
    const value = cleanCell(this.row[field]);
    if (value === null) return null;
    const result = parse(value);
    if (result.ok) return result.value;
    this.errors.push({ field: field as ImportIssue['field'], code: result.code });
    return null;
  }

  error(field: Field | null, code: ImportIssue['code']): void {
    this.errors.push({ field: field as ImportIssue['field'], code });
  }

  warn(field: Field | null, code: ImportIssue['code']): void {
    this.warnings.push({ field: field as ImportIssue['field'], code });
  }
}
