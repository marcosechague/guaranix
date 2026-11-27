import { z } from 'zod';
import { MEMBER_STATUSES } from '../domain/enums';
import {
  calendarDateSchema,
  documentNumberSchema,
  emailSchema,
  idSchema,
  nameSchema,
  phoneE164Schema,
} from './common';

export const memberSchema = z.object({
  id: idSchema,
  boxId: idSchema,
  userId: idSchema.nullable(),
  firstName: nameSchema,
  lastName: nameSchema,
  documentNumber: documentNumberSchema.nullable(),
  email: emailSchema.nullable(),
  phone: phoneE164Schema.nullable(),
  birthDate: calendarDateSchema.nullable(),
  emergencyContactName: z.string().trim().max(120).nullable(),
  emergencyContactPhone: phoneE164Schema.nullable(),
  medicalNotes: z.string().max(2000).nullable(),
  notes: z.string().max(2000).nullable(),
  status: z.enum(MEMBER_STATUSES),
  joinedOn: calendarDateSchema,
  externalRef: z.string().max(120).nullable(),
});

export const createMemberSchema = memberSchema
  .omit({ id: true, boxId: true, userId: true, status: true })
  .partial()
  .required({ firstName: true, lastName: true });

export const updateMemberSchema = createMemberSchema.partial().extend({
  status: z.enum(MEMBER_STATUSES).optional(),
});

export type Member = z.infer<typeof memberSchema>;
export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const listMembersQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(MEMBER_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>;
