import { z } from 'zod';
import { CHARGE_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from '../domain/enums';
import { calendarDateSchema, fileKeySchema, idSchema, positiveGuaraniAmountSchema } from './common';

export const chargeSchema = z.object({
  memberId: idSchema,
  memberPlanId: idSchema.nullable().default(null),
  description: z.string().trim().min(1).max(200),
  amountGs: positiveGuaraniAmountSchema,
  dueOn: calendarDateSchema,
  status: z.enum(CHARGE_STATUSES).default('open'),
});

export const recordPaymentSchema = z
  .object({
    memberId: idSchema,
    chargeId: idSchema.nullable().default(null),
    amountGs: positiveGuaraniAmountSchema,
    method: z.enum(PAYMENT_METHODS),
    paidAt: z.coerce.date(),
    /** Bank or QR operation number, when there is one. */
    reference: z.string().trim().max(120).nullable().default(null),
    receiptFileKey: fileKeySchema.nullable().default(null),
    notes: z.string().trim().max(1000).nullable().default(null),
  })
  .refine((payment) => payment.method !== 'qr' || payment.receiptFileKey !== null, {
    error: 'QR payments need a receipt',
    path: ['receiptFileKey'],
  });

export const reviewPaymentSchema = z.object({
  paymentId: idSchema,
  status: z.enum(PAYMENT_STATUSES).exclude(['pending_review']),
});

export type ChargeInput = z.input<typeof chargeSchema>;
export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;
export type ReviewPaymentInput = z.infer<typeof reviewPaymentSchema>;

export const listChargesQuerySchema = z.object({
  memberId: idSchema.optional(),
  status: z.enum(CHARGE_STATUSES).optional(),
});

export const listPaymentsQuerySchema = z.object({
  memberId: idSchema.optional(),
  status: z.enum(PAYMENT_STATUSES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

/** Box-local dates, both included. */
export const dashboardQuerySchema = z.object({
  from: calendarDateSchema,
  to: calendarDateSchema,
});

/** Receipts are photos or PDFs of a transfer or QR payment. */
export const RECEIPT_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;
export type ReceiptContentType = (typeof RECEIPT_CONTENT_TYPES)[number];
/** 5 MB: a phone photo fits; anything bigger is not a receipt. */
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

/** The API's receipt limits, checked in the browser before uploading; returns an error code. */
export function receiptFileProblem(file: {
  type: string;
  size: number;
}): 'receipt_type' | 'receipt_too_large' | null {
  if (!(RECEIPT_CONTENT_TYPES as readonly string[]).includes(file.type)) return 'receipt_type';
  return file.size > RECEIPT_MAX_BYTES ? 'receipt_too_large' : null;
}
