import { z } from 'zod';
import { idSchema } from './common';

/** `entity.verb`, e.g. `plan.price_changed` or `box.impersonated`. */
export const auditActionSchema = z.string().regex(/^[a-z_]+\.[a-z_]+$/);

export const auditLogEntrySchema = z.object({
  boxId: idSchema.nullable(),
  actorUserId: idSchema.nullable(),
  /** Set when a platform admin acts "as" a box, so the real person is never lost. */
  impersonatorUserId: idSchema.nullable().default(null),
  action: auditActionSchema,
  entityType: z.string().regex(/^[a-z_]+$/),
  entityId: idSchema.nullable(),
  changes: z.record(z.string(), z.unknown()).nullable().default(null),
});

export type AuditLogEntryInput = z.input<typeof auditLogEntrySchema>;
