import {
  type AiImportRequest,
  MAX_AI_IMPORT_FILE_BASE64,
  MAX_AI_IMPORT_SHEET_CHARS,
} from '@guaranix/shared';
import { readSpreadsheet, type SpreadsheetSheet, UnreadableFileError } from './read-spreadsheet';

export const AI_FILE_ACCEPT =
  'image/jpeg,image/png,image/webp,application/pdf,.pdf,.xlsx,.csv,text/csv';

// Enough to read handwriting; a full-size phone photo would be slow on 3G and costly to read.
const MAX_IMAGE_SIDE = 2000;
const JPEG_QUALITY = 0.85;

export class AiFileTooLargeError extends Error {
  constructor() {
    super('The file is too large to read with AI');
    this.name = 'AiFileTooLargeError';
  }
}

/** Every sheet as tab-separated text, so a messy layout reaches the model as it is. */
export function sheetsAsText(sheets: SpreadsheetSheet[]): string {
  return sheets
    .filter((sheet) => sheet.rows.some((cells) => cells.some(Boolean)))
    .map((sheet) => [`# ${sheet.name}`, ...sheet.rows.map((cells) => cells.join('\t'))].join('\n'))
    .join('\n\n');
}

function base64Of(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsDataURL(blob);
  });
}

async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image'))),
      'image/jpeg',
      JPEG_QUALITY,
    ),
  );
}

function checked<T extends { length: number }>(value: T, max: number): T {
  if (value.length > max) throw new AiFileTooLargeError();
  return value;
}

/** Turns what the admin picked into the request body: photos shrunk, sheets as text. */
export async function prepareAiFile(file: File): Promise<AiImportRequest> {
  const name = file.name.toLowerCase();
  const fileName = file.name.slice(0, 200);
  if (file.type.startsWith('image/')) {
    const data = await base64Of(await shrinkImage(file));
    return {
      kind: 'image',
      fileName,
      mediaType: 'image/jpeg',
      data: checked(data, MAX_AI_IMPORT_FILE_BASE64),
    };
  }
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
    const data = await base64Of(file);
    return { kind: 'pdf', fileName, data: checked(data, MAX_AI_IMPORT_FILE_BASE64) };
  }
  const text = sheetsAsText(await readSpreadsheet(file));
  if (!text) throw new UnreadableFileError();
  return { kind: 'sheet', fileName, text: checked(text, MAX_AI_IMPORT_SHEET_CHARS) };
}
