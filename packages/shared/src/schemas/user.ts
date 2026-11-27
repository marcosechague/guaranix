import { z } from 'zod';
import { BOX_ROLES } from '../domain/enums';
import { emailSchema, idSchema, nameSchema, phoneE164Schema } from './common';

export const userSchema = z.object({
  id: idSchema,
  email: emailSchema.nullable(),
  phone: phoneE164Schema.nullable(),
  fullName: nameSchema,
  isPlatformAdmin: z.boolean(),
});

export const createUserSchema = z
  .object({
    email: emailSchema.optional(),
    phone: phoneE164Schema.optional(),
    fullName: nameSchema,
  })
  .refine((user) => user.email !== undefined || user.phone !== undefined, {
    error: 'A user needs an email or a phone to receive login codes',
    path: ['email'],
  });

export const boxUserSchema = z.object({
  id: idSchema,
  boxId: idSchema,
  userId: idSchema,
  role: z.enum(BOX_ROLES),
  isActive: z.boolean(),
});

export const assignBoxRoleSchema = boxUserSchema.pick({ userId: true, role: true });

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type BoxUser = z.infer<typeof boxUserSchema>;
export type AssignBoxRoleInput = z.infer<typeof assignBoxRoleSchema>;
