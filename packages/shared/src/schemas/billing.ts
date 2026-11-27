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
