import { z } from 'zod';
import { PAYMENT_PROVIDER_ENVIRONMENTS, PAYMENT_PROVIDERS } from '../domain/enums';
import { idSchema } from './common';

const providerKeySchema = z.string().trim().min(8).max(200);

/** The box's own processor account. The private key is write-only: it never comes back. */
export const connectPaymentAccountSchema = z.object({
  provider: z.enum(PAYMENT_PROVIDERS),
  environment: z.enum(PAYMENT_PROVIDER_ENVIRONMENTS),
  publicKey: providerKeySchema,
  privateKey: providerKeySchema,
  autopayEnabled: z.boolean().default(false),
});

export const updatePaymentAccountSchema = z.object({ autopayEnabled: z.boolean() });

/** A member must accept automatic charges explicitly before saving a card. */
export const startCardRegistrationSchema = z.object({ acceptAutopay: z.literal(true) });

export const createPaymentLinkSchema = z.object({ chargeId: idSchema });

export const listPaymentAttemptsQuerySchema = z.object({
  chargeId: idSchema.optional(),
  memberId: idSchema.optional(),
});

/** Development only: the mock processor's "approve" and "decline" buttons. */
export const simulatePaymentSchema = z.object({ approved: z.boolean() });

/** The opaque token at the end of a payment link (32 random bytes, base64url). */
export const paymentLinkTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export type ConnectPaymentAccountInput = z.input<typeof connectPaymentAccountSchema>;
export type UpdatePaymentAccountInput = z.infer<typeof updatePaymentAccountSchema>;
