import { auditLogs } from '@guaranix/db/schema';
import type { ServiceContext } from './context';

interface AuditEntry {
  action: `${string}.${string}`;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
}

/**
 * Who changed prices, plans, payments, permissions or member data (CLAUDE.md,
 * Seguridad). Actions starting with `support.` record what platform support
 * looked at while "entering as" a box; only the platform reads them.
 */
export async function recordAudit(context: ServiceContext, entry: AuditEntry): Promise<void> {
  await context.transaction.insert(auditLogs).values({
    boxId: context.auth.boxId,
    actorUserId: context.auth.userId,
    impersonatorUserId: context.auth.impersonatorUserId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    changes: entry.changes ?? null,
  });
}

/** Only the fields that actually changed, as `{ field: { from, to } }`. */
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [field, value] of Object.entries(after)) {
    if (value !== undefined && before[field] !== value) {
      changes[field] = { from: before[field], to: value };
    }
  }
  return changes;
}

/** A change made by GuaraniX itself (the autopay job, a processor webhook): no user behind it. */
export async function recordSystemAudit(
  transaction: ServiceContext['transaction'],
  boxId: string,
  entry: AuditEntry,
): Promise<void> {
  await transaction.insert(auditLogs).values({
    boxId,
    actorUserId: null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    changes: entry.changes ?? null,
  });
}
