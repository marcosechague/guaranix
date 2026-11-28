import { z } from 'zod';
import { BOX_STATUSES } from '../domain/enums';
import { emailSchema, hexColorSchema, idSchema, nameSchema, phoneE164Schema } from './common';

export const boxSlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .min(3)
  .max(48);

/** Paraguayan RUC with its check digit, e.g. `80012345-6`. */
export const rucSchema = z.string().regex(/^\d{5,8}-\d$/);

export const bookingPolicySchema = z.object({
  bookingOpensHoursBefore: z
    .number()
    .int()
    .min(1)
    .max(24 * 30),
  bookingClosesMinutesBefore: z
    .number()
    .int()
    .min(0)
    .max(24 * 60),
  lateCancelMinutesBefore: z
    .number()
    .int()
    .min(0)
    .max(24 * 60),
  lateCancelConsumesCredit: z.boolean(),
  noShowConsumesCredit: z.boolean(),
  waitlistAutoPromote: z.boolean(),
});

export const boxSchema = z.object({
  id: idSchema,
  name: nameSchema,
  slug: boxSlugSchema,
  legalName: nameSchema.nullable(),
  ruc: rucSchema.nullable(),
  email: emailSchema.nullable(),
  phone: phoneE164Schema.nullable(),
  address: z.string().trim().max(240).nullable(),
  city: z.string().trim().max(80).nullable(),
  timezone: z.string().min(1),
  accentColor: hexColorSchema.nullable(),
  logoFileKey: z.string().nullable(),
  status: z.enum(BOX_STATUSES),
  trialEndsAt: z.date().nullable(),
  platformPlanId: idSchema.nullable(),
  ...bookingPolicySchema.shape,
});

export const createBoxSchema = boxSchema
  .pick({ name: true, slug: true, city: true, email: true, phone: true })
  .partial({ city: true, email: true, phone: true });

export const updateBoxSchema = boxSchema
  .omit({ id: true, slug: true, status: true, trialEndsAt: true, platformPlanId: true })
  .partial();

export type Box = z.infer<typeof boxSchema>;
export type CreateBoxInput = z.infer<typeof createBoxSchema>;
export type UpdateBoxInput = z.infer<typeof updateBoxSchema>;

/** URL-safe slug from a box name: "Ñu Guasú Training" → "nu-guasu-training". */
export function slugFromName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug.length >= 3 ? slug : `box-${slug || 'nuevo'}`.slice(0, 40);
}

/** Staff send the whole policy, so the form and the stored rules never drift apart. */
export type BookingPolicy = z.infer<typeof bookingPolicySchema>;
