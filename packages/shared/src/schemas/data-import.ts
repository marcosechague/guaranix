import { z } from 'zod';
import { IMPORT_SOURCES } from '../domain/enums';
import {
  MAX_IMPORT_MEMBER_ROWS,
  MAX_IMPORT_PLAN_ROWS,
  MEMBER_IMPORT_FIELDS,
  PLAN_IMPORT_FIELDS,
} from '../imports/fields';

const cellSchema = z.string().max(2000);

export const memberImportRowSchema = z.partialRecord(z.enum(MEMBER_IMPORT_FIELDS), cellSchema);
export const planImportRowSchema = z.partialRecord(z.enum(PLAN_IMPORT_FIELDS), cellSchema);

/**
 * A spreadsheet already mapped to fields, cells still as text: the API reads
 * them with the same rules as the preview, so both always agree.
 */
export const dataImportSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  source: z.enum(IMPORT_SOURCES),
  /** Description of the charge created for a member's outstanding balance. */
  balanceDescription: z.string().trim().min(1).max(200),
  members: z.array(memberImportRowSchema).min(1).max(MAX_IMPORT_MEMBER_ROWS),
  plans: z.array(planImportRowSchema).max(MAX_IMPORT_PLAN_ROWS).default([]),
  /** Import the valid rows and leave the rest out; otherwise any error stops the import. */
  skipInvalidRows: z.boolean().default(false),
});

export type DataImportInput = z.output<typeof dataImportSchema>;
export type DataImportRequest = z.input<typeof dataImportSchema>;
