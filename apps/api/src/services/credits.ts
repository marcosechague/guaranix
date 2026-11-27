import { and, eq, gt, isNotNull, sql } from 'drizzle-orm';
import { memberPlans } from '@guaranix/db/schema';
import type { ServiceContext } from './context';
import { unprocessable } from './errors';

/**
 * Takes one class credit from a pack or drop-in. Plans without credits
 * (unlimited, weekly) are left alone. The `> 0` guard in the same statement
 * keeps two concurrent bookings from spending the last credit twice.
 */
export async function consumeCredit(context: ServiceContext, memberPlanId: string): Promise<void> {
  const [plan] = await context.transaction
    .select({ classesRemaining: memberPlans.classesRemaining })
    .from(memberPlans)
    .where(eq(memberPlans.id, memberPlanId));
  if (!plan || plan.classesRemaining === null) return;
  const updated = await context.transaction
    .update(memberPlans)
    .set({ classesRemaining: sql`${memberPlans.classesRemaining} - 1` })
    .where(and(eq(memberPlans.id, memberPlanId), gt(memberPlans.classesRemaining, 0)))
    .returning({ id: memberPlans.id });
  if (updated.length === 0) throw unprocessable('no_credits_left');
}

/** Gives a credit back to a pack or drop-in after a timely cancellation. */
export async function refundCredit(context: ServiceContext, memberPlanId: string): Promise<void> {
  await context.transaction
    .update(memberPlans)
    .set({ classesRemaining: sql`${memberPlans.classesRemaining} + 1` })
    .where(and(eq(memberPlans.id, memberPlanId), isNotNull(memberPlans.classesRemaining)));
}
