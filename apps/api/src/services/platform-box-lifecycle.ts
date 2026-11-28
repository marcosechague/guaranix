import { boxes, users } from '@guaranix/db/schema';
import type { BoxStatus, CreatePlatformBoxInput } from '@guaranix/shared';
import { createPlatformBoxSchema } from '@guaranix/shared';
import { eq } from 'drizzle-orm';
import { provisionBox } from './box-provisioning';
import { unprocessable } from './errors';
import { type PlatformContext, recordPlatformAudit } from './platform-context';
import { getPlatformBox, lockBox } from './platform-boxes';
import { assertPlanAvailable } from './platform-plans';

/** Finds the owner's account by email, or creates one they claim with Google or a reset link. */
async function ownerAccount(context: PlatformContext, email: string, fullName: string) {
  const [existing] = await context.transaction
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  if (existing) return existing.id;
  const [created] = await context.transaction
    .insert(users)
    .values({ email, fullName })
    .returning({ id: users.id });
  if (!created) throw new Error('User insert returned no row');
  return created.id;
}

export async function createPlatformBox(context: PlatformContext, input: CreatePlatformBoxInput) {
  const values = createPlatformBoxSchema.parse(input);
  await assertPlanAvailable(context, values.platformPlanId);
  const ownerUserId = await ownerAccount(context, values.ownerEmail, values.ownerName);
  const box = await provisionBox(context.transaction, { ...values, ownerUserId }, context.now);
  await recordPlatformAudit(context, {
    action: 'box.created',
    entityType: 'box',
    entityId: box.id,
    boxId: box.id,
    changes: { name: box.name, slug: box.slug, platformPlanId: box.platformPlanId, ownerUserId },
  });
  return getPlatformBox(context, box.id);
}

/** Which status each action may start from. Removing is a soft delete: data stays for audit. */
const TRANSITIONS = {
  suspend: { from: ['trial', 'active'], to: 'suspended', action: 'box.suspended' },
  reactivate: { from: ['suspended', 'cancelled'], to: 'active', action: 'box.reactivated' },
  remove: { from: ['trial', 'active', 'suspended'], to: 'cancelled', action: 'box.removed' },
} as const satisfies Record<
  string,
  { from: readonly BoxStatus[]; to: BoxStatus; action: `box.${string}` }
>;

export type BoxStatusAction = keyof typeof TRANSITIONS;

export async function changeBoxStatus(
  context: PlatformContext,
  boxId: string,
  action: BoxStatusAction,
  reason: string | null,
) {
  const transition = TRANSITIONS[action];
  const before = await lockBox(context, boxId);
  if (!(transition.from as readonly BoxStatus[]).includes(before.status)) {
    throw unprocessable('box_status_unchanged');
  }
  // Removed boxes free their plan's place, so coming back must fit in it again.
  if (before.status === 'cancelled' && before.platformPlanId) {
    await assertPlanAvailable(context, before.platformPlanId);
  }
  // A box back from suspension resumes its trial if there is time left.
  const to: BoxStatus =
    action === 'reactivate' && before.trialEndsAt && before.trialEndsAt > context.now
      ? 'trial'
      : transition.to;
  await context.transaction
    .update(boxes)
    .set({ status: to, statusReason: reason, statusChangedAt: context.now })
    .where(eq(boxes.id, boxId));
  await recordPlatformAudit(context, {
    action: transition.action,
    entityType: 'box',
    entityId: boxId,
    boxId,
    changes: { status: { from: before.status, to }, ...(reason ? { reason } : {}) },
  });
  return getPlatformBox(context, boxId);
}
