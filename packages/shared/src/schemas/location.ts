import { z } from 'zod';
import { idSchema, nameSchema, phoneE164Schema } from './common';

const addressSchema = z.string().trim().max(240).nullable();
const citySchema = z.string().trim().max(120).nullable();

export const locationSchema = z.object({
  id: idSchema,
  boxId: idSchema,
  name: nameSchema,
  address: addressSchema,
  city: citySchema,
  phone: phoneE164Schema.nullable(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
});

export const createLocationSchema = z.object({
  name: nameSchema,
  address: addressSchema.default(null),
  city: citySchema.default(null),
  phone: phoneE164Schema.nullable().default(null),
});

/** `isDefault: true` moves the default here; the previous default stays open. */
export const updateLocationSchema = z
  .object({
    name: nameSchema,
    address: addressSchema,
    city: citySchema,
    phone: phoneE164Schema.nullable(),
    isActive: z.boolean(),
    isDefault: z.literal(true),
  })
  .partial();

export type Location = z.infer<typeof locationSchema>;
export type CreateLocationInput = z.output<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
