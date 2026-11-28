import { notifications } from '@guaranix/db/schema';
import type { NotificationAudience, NotificationKind, NotificationParams } from '@guaranix/shared';
import type { ScopedTransaction } from '@guaranix/db';
import type { ServiceContext } from '../context';

export interface NotificationEvent {
  kind: NotificationKind;
  /** Same key, same event: recording it again does nothing (e.g. `class_cancelled:<id>`). */
  key: string;
  audience: NotificationAudience;
  params: NotificationParams;
}

function isEmpty(audience: NotificationAudience): boolean {
  if (audience.type === 'members') return audience.memberIds.length === 0;
  if (audience.type === 'users') return audience.userIds.length === 0;
  return false;
}

/**
 * Writes the event to the outbox inside `transaction`, so it exists only if the
 * surrounding change commits. Returns its id, or null when it was already
 * recorded or has nobody to tell.
 */
export async function insertNotification(
  transaction: ScopedTransaction,
  origin: { boxId: string; actorUserId: string | null },
  event: NotificationEvent,
): Promise<string | null> {
  if (isEmpty(event.audience)) return null;
  const [row] = await transaction
    .insert(notifications)
    .values({
      boxId: origin.boxId,
      kind: event.kind,
      idempotencyKey: `${event.kind}:${event.key}`,
      audience: event.audience,
      params: event.params,
      actorUserId: origin.actorUserId,
    })
    .onConflictDoNothing({ target: [notifications.boxId, notifications.idempotencyKey] })
    .returning({ id: notifications.id });
  return row?.id ?? null;
}

/** `insertNotification` for a request: the router queues it once the transaction commits. */
export async function recordNotification(
  context: ServiceContext,
  event: NotificationEvent,
): Promise<string | null> {
  const id = await insertNotification(
    context.transaction,
    { boxId: context.auth.boxId, actorUserId: context.auth.userId },
    event,
  );
  if (id) context.outbox?.push(id);
  return id;
}
