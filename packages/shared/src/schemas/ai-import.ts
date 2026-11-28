import { z } from 'zod';
import type { MemberImportRow, PlanImportRow } from '../imports/fields';

/** About 6 MB of file once decoded: a phone photo or a few PDF pages. */
export const MAX_AI_IMPORT_FILE_BASE64 = 8_000_000;
/** A messy sheet goes as text; past this it is cheaper and safer to split it. */
export const MAX_AI_IMPORT_SHEET_CHARS = 120_000;

export const AI_IMPORT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const fileName = z.string().trim().min(1).max(200);

/**
 * What the admin sends to be read by AI: a photo, a PDF, or a sheet the browser
 * already turned into tab-separated text. Only the file goes to the provider.
 */
export const aiImportRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('image'),
    fileName,
    mediaType: z.enum(AI_IMPORT_IMAGE_TYPES),
    data: z.base64().max(MAX_AI_IMPORT_FILE_BASE64),
  }),
  z.object({
    kind: z.literal('pdf'),
    fileName,
    data: z.base64().max(MAX_AI_IMPORT_FILE_BASE64),
  }),
  z.object({
    kind: z.literal('sheet'),
    fileName,
    text: z.string().min(1).max(MAX_AI_IMPORT_SHEET_CHARS),
  }),
]);

export type AiImportRequest = z.input<typeof aiImportRequestSchema>;

/** Rows proposed by the model, cells as text: the same shape a mapped spreadsheet produces. */
export interface AiImportProposal {
  members: MemberImportRow[];
  plans: PlanImportRow[];
}

export interface AiImportStatus {
  enabled: boolean;
  monthlyLimit: number | null;
  usedThisMonth: number;
}
