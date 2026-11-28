import { parseCsv } from '@guaranix/shared';

export interface SpreadsheetSheet {
  name: string;
  /** Every cell as text; the API reads amounts and dates from text. */
  rows: string[][];
}

export class UnreadableFileError extends Error {
  constructor() {
    super('The file is not a readable spreadsheet');
    this.name = 'UnreadableFileError';
  }
}

export const SPREADSHEET_ACCEPT = '.xlsx,.csv,text/csv';

/** Spreadsheet dates arrive as `Date` at UTC midnight; keep the calendar day. */
export function cellToText(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date)
    return Number.isNaN(cell.getTime()) ? '' : cell.toISOString().slice(0, 10);
  if (typeof cell === 'number') return String(cell);
  if (typeof cell === 'boolean') return cell ? 'active' : 'inactive';
  return String(cell).trim();
}

/** Reads an `.xlsx` workbook (every sheet) or a CSV file (one sheet named after the file). */
export async function readSpreadsheet(file: File): Promise<SpreadsheetSheet[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || file.type === 'text/csv') {
    return [{ name: file.name, rows: parseCsv(await file.text()) }];
  }
  if (!name.endsWith('.xlsx')) throw new UnreadableFileError();
  // Loaded only here, so the rest of the panel doesn't download the Excel reader.
  const { default: readXlsxFile } = await import('read-excel-file/browser');
  try {
    const sheets = await readXlsxFile(file);
    return sheets.map((sheet) => ({
      name: sheet.sheet,
      rows: sheet.data.map((row) => row.map(cellToText)),
    }));
  } catch {
    throw new UnreadableFileError();
  }
}
