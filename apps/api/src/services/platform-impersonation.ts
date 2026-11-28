import { endImpersonation, startImpersonation } from './sessions';
import { unprocessable } from './errors';
import { type PlatformContext, recordPlatformAudit } from './platform-context';
import { lockBox } from './platform-boxes';

/**
 * "Entrar como": the admin's session works inside the box as its owner for an
 * hour. Both ends are audited in the box's own trail, and every write made
 * meanwhile carries the admin as `impersonator_user_id`.
 */
export async function impersonateBox(context: PlatformContext, boxId: string) {
  const box = await lockBox(context, boxId);
  if (box.status === 'cancelled') throw unprocessable('box_status_unchanged');
  const endsAt = await startImpersonation(
    context.transaction,
    context.sessionId,
    boxId,
    context.now,
  );
  await recordPlatformAudit(context, {
    action: 'box.impersonation_started',
    entityType: 'box',
    entityId: boxId,
    boxId,
    changes: { endsAt: endsAt.toISOString() },
  });
}

export async function stopImpersonating(context: PlatformContext, boxId: string | null) {
  await endImpersonation(context.transaction, context.sessionId);
  if (!boxId) return;
  await recordPlatformAudit(context, {
    action: 'box.impersonation_ended',
    entityType: 'box',
    entityId: boxId,
    boxId,
  });
}
