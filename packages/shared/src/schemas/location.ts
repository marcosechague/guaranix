import { z } from 'zod';
import { idSchema, nameSchema, phoneE164Schema } from './common';

const addressSchema = z.string().trim().max(240).nullable();
const citySchema = z.string().trim().max(120).nullable();
export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);
const bothOrNeither = (value: {
  latitude?: number | null | undefined;
  longitude?: number | null | undefined;
}) =>
  (value.latitude === undefined) === (value.longitude === undefined) &&
  (value.latitude === null) === (value.longitude === null);

export const locationSchema = z.object({
  id: idSchema,
  boxId: idSchema,
  name: nameSchema,
  address: addressSchema,
  city: citySchema,
  phone: phoneE164Schema.nullable(),
  latitude: latitudeSchema.nullable(),
  longitude: longitudeSchema.nullable(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
});

export const createLocationSchema = z
  .object({
    name: nameSchema,
    address: addressSchema.default(null),
    city: citySchema.default(null),
    phone: phoneE164Schema.nullable().default(null),
    latitude: latitudeSchema.nullable().default(null),
    longitude: longitudeSchema.nullable().default(null),
  })
  .refine(bothOrNeither, { path: ['longitude'] });

/** `isDefault: true` moves the default here; the previous default stays open. */
export const updateLocationSchema = z
  .object({
    name: nameSchema,
    address: addressSchema,
    city: citySchema,
    phone: phoneE164Schema.nullable(),
    latitude: latitudeSchema.nullable(),
    longitude: longitudeSchema.nullable(),
    isActive: z.boolean(),
    isDefault: z.literal(true),
  })
  .partial()
  .refine(bothOrNeither, { path: ['longitude'] });

export type Location = z.infer<typeof locationSchema>;
export type CreateLocationInput = z.output<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
