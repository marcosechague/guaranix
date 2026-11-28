import { boxes } from '@guaranix/db/schema';
import type { BookingPolicy } from '@guaranix/shared/schemas';
import { eq } from 'drizzle-orm';
import { diff, recordAudit } from './audit';
import { currentBox } from './box-calendar';
import { MANAGER_ROLES, STAFF_ROLES, assertRole, type ServiceContext } from './context';
import { notFound } from './errors';

const POLICY_FIELDS = [
  'bookingOpensHoursBefore',
  'bookingClosesMinutesBefore',
  'lateCancelMinutesBefore',
  'lateCancelConsumesCredit',
  'noShowConsumesCredit',
  'waitlistAutoPromote',
] as const satisfies readonly (keyof BookingPolicy)[];

function pickPolicy(row: BookingPolicy): BookingPolicy {
  return Object.fromEntries(POLICY_FIELDS.map((field) => [field, row[field]])) as BookingPolicy;
}

export async function getBookingPolicy(context: ServiceContext): Promise<BookingPolicy> {
  assertRole(context.auth.role, STAFF_ROLES);
  return pickPolicy(await currentBox(context));
}

/** Changes when members may book and cancel. Only owners and admins, and always audited. */
export async function updateBookingPolicy(
  context: ServiceContext,
  input: BookingPolicy,
): Promise<BookingPolicy> {
  assertRole(context.auth.role, MANAGER_ROLES);
  const before = pickPolicy(await currentBox(context));
  const [updated] = await context.transaction
    .update(boxes)
    .set({ ...input, updatedAt: context.now })
    .where(eq(boxes.id, context.auth.boxId))
    .returning();
  if (!updated) throw notFound('box');
  const after = pickPolicy(updated);
  await recordAudit(context, {
    action: 'box.booking_policy_updated',
    entityType: 'box',
    entityId: context.auth.boxId,
    changes: diff(before, after),
  });
  return after;
}
