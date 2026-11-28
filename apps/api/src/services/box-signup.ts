import type { ScopedTransaction } from '@guaranix/db';
import { auditLogs, platformPlans, sessions } from '@guaranix/db/schema';
import {
  type BoxSignupInput,
  blockingIssues,
  boxSignupSchema,
  reviewBoxSetup,
  type SetupIssue,
} from '@guaranix/shared';
import { eq, inArray } from 'drizzle-orm';
import { provisionBox } from './box-provisioning';
import { unprocessable } from './errors';
import { boxesOnPlan } from './platform-plans';

/** Plans offered at self sign-up, best first: founders while there is room, then base. */
const SIGNUP_PLAN_CODES = ['founders', 'base'];
const TRIAL_DAYS = 30;

export class SetupRejected extends Error {
  constructor(
    readonly code: 'setup_invalid' | 'setup_needs_confirmation',
    readonly issues: SetupIssue[],
  ) {
    super(code);
  }
}

async function signupPlan(transaction: ScopedTransaction) {
  const candidates = await transaction
    .select()
    .from(platformPlans)
    .where(inArray(platformPlans.code, SIGNUP_PLAN_CODES))
    .for('update');
  for (const code of SIGNUP_PLAN_CODES) {
    const plan = candidates.find((candidate) => candidate.code === code && candidate.isActive);
    if (!plan) continue;
    if (plan.boxLimit === null) return plan;
    if ((await boxesOnPlan(transaction, plan.id)) < plan.boxLimit) return plan;
  }
  throw unprocessable('signup_unavailable');
}

interface Caller {
  userId: string;
  sessionId: string;
}

/**
 * A person creates their own box: checked against `reviewBoxSetup` (errors
 * always block; warnings need `acceptWarnings`), created in trial with them as
 * owner, and made the session's active box.
 */
export async function signUpBox(
  transaction: ScopedTransaction,
  caller: Caller,
  input: BoxSignupInput,
  now: Date,
) {
  const values = boxSignupSchema.parse(input);
  const issues = reviewBoxSetup(values.setup);
  if (blockingIssues(issues).length > 0) throw new SetupRejected('setup_invalid', issues);
  if (issues.length > 0 && !values.acceptWarnings) {
    throw new SetupRejected('setup_needs_confirmation', issues);
  }
  const plan = await signupPlan(transaction);
  const box = await provisionBox(
    transaction,
    {
      name: values.name,
      slug: values.slug,
      city: values.city,
      phone: values.phone,
      bookingOpensHoursBefore: values.bookingOpensHoursBefore,
      businessType: values.businessType,
      platformPlanId: plan.id,
      ownerUserId: caller.userId,
      trialDays: TRIAL_DAYS,
      setup: values.setup,
    },
    now,
  );
  await transaction
    .update(sessions)
    .set({ activeBoxId: box.id })
    .where(eq(sessions.id, caller.sessionId));
  await transaction.insert(auditLogs).values({
    boxId: box.id,
    actorUserId: caller.userId,
    action: 'box.signed_up',
    entityType: 'box',
    entityId: box.id,
    changes: {
      businessType: values.businessType,
      platformPlan: plan.code,
      acceptedWarnings: issues.map((issue) => issue.code),
    },
  });
  return {
    box: { id: box.id, name: box.name, slug: box.slug },
    platformPlan: { code: plan.code, name: plan.name, monthlyPriceGs: plan.monthlyPriceGs },
    trialEndsAt: box.trialEndsAt?.toISOString() ?? null,
  };
}
