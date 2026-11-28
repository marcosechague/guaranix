import type { ScopedTransaction } from '@guaranix/db';
import { auditLogs } from '@guaranix/db/schema';

/**
 * Context for GuaraniX's own superadmin tools. The transaction is unscoped
 * (it sees every box), so these services must only ever be reached through
 * `createPlatformRouter`, which checks the platform admin flag.
 */
export interface PlatformContext {
  transaction: ScopedTransaction;
  actorUserId: string;
  sessionId: string;
  now: Date;
}

interface PlatformAuditEntry {
  action: `${string}.${string}`;
  entityType: string;
  /** Null for platform-wide settings that have no row id (AI provider, keys). */
  entityId: string | null;
  /** The box affected, so its own audit trail shows what the platform did. */
  boxId: string | null;
  changes?: Record<string, unknown>;
}

export async function recordPlatformAudit(
  context: PlatformContext,
  entry: PlatformAuditEntry,
): Promise<void> {
  await context.transaction.insert(auditLogs).values({
    boxId: entry.boxId,
    actorUserId: context.actorUserId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    changes: entry.changes ?? null,
  });
}
