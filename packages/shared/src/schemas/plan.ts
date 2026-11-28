import { z } from 'zod';
import { MEMBER_PLAN_STATUSES, PLAN_KINDS, type PlanKind } from '../domain/enums';
import {
  calendarDateSchema,
  guaraniAmountSchema,
  idSchema,
  isOnOrAfter,
  nameSchema,
} from './common';

const planShape = {
  name: nameSchema,
  description: z.string().trim().max(500).nullable(),
  kind: z.enum(PLAN_KINDS),
  priceGs: guaraniAmountSchema,
  /** Only for `weekly_limit`. */
  classesPerWeek: z.number().int().min(1).max(14).nullable(),
  /** Credits granted: required for `class_pack`, always 1 for `drop_in`. */
  classCount: z.number().int().min(1).max(500).nullable(),
  /** How long the plan is valid once started. */
  durationDays: z.number().int().min(1).max(366),
  isActive: z.boolean(),
};

type PlanLimits = { kind: PlanKind; classesPerWeek: number | null; classCount: number | null };

/** Mirrors the `plans_kind_limits` check constraint in the database. */
export function planLimitIssues(plan: PlanLimits): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  const needsWeekly = plan.kind === 'weekly_limit';
  if (needsWeekly !== (plan.classesPerWeek !== null)) {
    issues.push({
      path: 'classesPerWeek',
      message: needsWeekly
        ? 'Weekly plans need classesPerWeek'
        : 'Only weekly plans set classesPerWeek',
    });
  }
  if (plan.kind === 'class_pack' && (plan.classCount === null || plan.classCount < 2)) {
    issues.push({ path: 'classCount', message: 'Class packs need at least 2 classes' });
  }
  if (plan.kind === 'drop_in' && plan.classCount !== 1) {
    issues.push({ path: 'classCount', message: 'Drop-in plans grant exactly 1 class' });
  }
  if ((plan.kind === 'unlimited' || needsWeekly) && plan.classCount !== null) {
    issues.push({ path: 'classCount', message: 'Only packs and drop-ins grant class credits' });
  }
  return issues;
}

function refinePlanLimits(plan: PlanLimits, context: z.RefinementCtx) {
  for (const issue of planLimitIssues(plan)) {
    context.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
  }
}

export const planSchema = z
  .object({ id: idSchema, boxId: idSchema, ...planShape })
  .superRefine(refinePlanLimits);

export const createPlanSchema = z
  .object({
    ...planShape,
    description: planShape.description.default(null),
    classesPerWeek: planShape.classesPerWeek.default(null),
    classCount: planShape.classCount.default(null),
    isActive: planShape.isActive.default(true),
    /** Empty means the plan gives access to every program. */
    programIds: z.array(idSchema).max(50).default([]),
    /** Empty means the plan works at every location (the pass between locations). */
    locationIds: z.array(idSchema).max(50).default([]),
  })
  .superRefine(refinePlanLimits);

export const memberPlanSchema = z
  .object({
    id: idSchema,
    boxId: idSchema,
    memberId: idSchema,
    planId: idSchema,
    status: z.enum(MEMBER_PLAN_STATUSES),
    startsOn: calendarDateSchema,
    endsOn: calendarDateSchema,
    /** Price frozen at sale time, so later price changes don't rewrite history. */
    priceGs: guaraniAmountSchema,
    classesRemaining: z.number().int().min(0).nullable(),
  })
  .refine((memberPlan) => isOnOrAfter(memberPlan.endsOn, memberPlan.startsOn), {
    error: 'endsOn must not be before startsOn',
    path: ['endsOn'],
  });

export const assignMemberPlanSchema = z.object({
  memberId: idSchema,
  planId: idSchema,
  startsOn: calendarDateSchema,
  /** Lets reception apply a discount; defaults to the plan price. */
  priceGs: guaraniAmountSchema.optional(),
});

export const planPauseSchema = z
  .object({
    memberPlanId: idSchema,
    startsOn: calendarDateSchema,
    endsOn: calendarDateSchema,
    reason: z.string().trim().max(500).nullable().default(null),
  })
  .refine((pause) => isOnOrAfter(pause.endsOn, pause.startsOn), {
    error: 'endsOn must not be before startsOn',
    path: ['endsOn'],
  });

export type Plan = z.infer<typeof planSchema>;
export type CreatePlanInput = z.input<typeof createPlanSchema>;
export type MemberPlan = z.infer<typeof memberPlanSchema>;
export type AssignMemberPlanInput = z.infer<typeof assignMemberPlanSchema>;
export type PlanPauseInput = z.input<typeof planPauseSchema>;
