import {
  auditLogs,
  boxUsers,
  boxes,
  members,
  oauthAccounts,
  platformPlans,
  userCredentials,
  users,
} from '@guaranix/db/schema';
import type {
  PlatformBoxFilter,
  PlatformBoxSummary,
  UpdatePlatformBoxInput,
} from '@guaranix/shared';
import { and, asc, count, desc, eq, ilike, inArray, or, type SQL, sql } from 'drizzle-orm';
import { diff } from './audit';
import { notFound } from './errors';
import { definedFields } from './objects';
import { type PlatformContext, recordPlatformAudit } from './platform-context';
import { assertPlanAvailable } from './platform-plans';

type PlanPrices = { monthlyPriceGs: number; extraLocationMonthlyPriceGs: number } | null;

/** What a box pays GuaraniX per month: its plan plus each extra location. */
export function monthlyFeeGs(plan: PlanPrices, extraLocations: number): number {
  if (!plan) return 0;
  return plan.monthlyPriceGs + extraLocations * plan.extraLocationMonthlyPriceGs;
}

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (match) => `\\${match}`);

export async function listPlatformBoxes(
  context: PlatformContext,
  query: { status: PlatformBoxFilter; search?: string | undefined },
): Promise<PlatformBoxSummary[]> {
  const filters: (SQL | undefined)[] = [];
  if (query.status !== 'all') filters.push(eq(boxes.status, query.status));
  if (query.search) {
    const pattern = `%${escapeLike(query.search)}%`;
    filters.push(
      or(ilike(boxes.name, pattern), ilike(boxes.city, pattern), ilike(boxes.slug, pattern)),
    );
  }
  const rows = await context.transaction
    .select({ box: boxes, plan: platformPlans })
    .from(boxes)
    .leftJoin(platformPlans, eq(platformPlans.id, boxes.platformPlanId))
    .where(and(...filters))
    .orderBy(desc(boxes.createdAt));
  return summarize(context, rows);
}

export async function getPlatformBox(context: PlatformContext, boxId: string) {
  const rows = await context.transaction
    .select({ box: boxes, plan: platformPlans })
    .from(boxes)
    .leftJoin(platformPlans, eq(platformPlans.id, boxes.platformPlanId))
    .where(eq(boxes.id, boxId));
  const [summary] = await summarize(context, rows);
  if (!summary) throw notFound('box');
  const activity = await context.transaction
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      createdAt: auditLogs.createdAt,
      actorName: users.fullName,
      impersonated: auditLogs.impersonatorUserId,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(eq(auditLogs.boxId, boxId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(20);
  return {
    box: summary,
    activity: activity.map(({ impersonated, createdAt, ...entry }) => ({
      ...entry,
      createdAt: createdAt.toISOString(),
      impersonated: impersonated !== null,
    })),
  };
}

export async function updatePlatformBox(
  context: PlatformContext,
  boxId: string,
  input: UpdatePlatformBoxInput,
) {
  const before = await lockBox(context, boxId);
  if (input.platformPlanId && input.platformPlanId !== before.platformPlanId) {
    await assertPlanAvailable(context, input.platformPlanId);
  }
  await context.transaction.update(boxes).set(definedFields(input)).where(eq(boxes.id, boxId));
  await recordPlatformAudit(context, {
    action: 'box.platform_updated',
    entityType: 'box',
    entityId: boxId,
    boxId,
    changes: diff(before, definedFields(input)),
  });
  return getPlatformBox(context, boxId);
}

export async function lockBox(context: PlatformContext, boxId: string) {
  const [box] = await context.transaction
    .select()
    .from(boxes)
    .where(eq(boxes.id, boxId))
    .for('update');
  if (!box) throw notFound('box');
  return box;
}

/** True while the owner has neither a password nor Google linked: they never got in. */
const ownerAccessPending = sql<boolean>`not exists (select 1 from ${userCredentials} where ${userCredentials.userId} = ${users.id}) and not exists (select 1 from ${oauthAccounts} where ${oauthAccounts.userId} = ${users.id})`;

type BoxRow = { box: typeof boxes.$inferSelect; plan: typeof platformPlans.$inferSelect | null };

async function summarize(context: PlatformContext, rows: BoxRow[]): Promise<PlatformBoxSummary[]> {
  const boxIds = rows.map(({ box }) => box.id);
  if (boxIds.length === 0) return [];
  const [memberCounts, owners] = await Promise.all([
    context.transaction
      .select({ boxId: members.boxId, total: count() })
      .from(members)
      .where(and(inArray(members.boxId, boxIds), eq(members.status, 'active')))
      .groupBy(members.boxId),
    context.transaction
      .select({
        boxId: boxUsers.boxId,
        fullName: users.fullName,
        email: users.email,
        accessPending: ownerAccessPending,
      })
      .from(boxUsers)
      .innerJoin(users, eq(users.id, boxUsers.userId))
      .where(and(inArray(boxUsers.boxId, boxIds), eq(boxUsers.role, 'box_owner')))
      .orderBy(asc(boxUsers.createdAt)),
  ]);
  const membersByBox = new Map(memberCounts.map((row) => [row.boxId, row.total]));
  const ownerByBox = new Map<
    string,
    { fullName: string; email: string | null; accessPending: boolean }
  >();
  for (const { boxId, ...owner } of owners)
    if (!ownerByBox.has(boxId)) ownerByBox.set(boxId, owner);

  return rows.map(({ box, plan }) => ({
    id: box.id,
    name: box.name,
    slug: box.slug,
    city: box.city,
    businessType: box.businessType,
    status: box.status,
    statusReason: box.statusReason,
    trialEndsAt: box.trialEndsAt?.toISOString() ?? null,
    createdAt: box.createdAt.toISOString(),
    platformPlan: plan ? { id: plan.id, name: plan.name, code: plan.code } : null,
    extraLocations: box.extraLocations,
    monthlyFeeGs: monthlyFeeGs(plan, box.extraLocations),
    activeMembers: membersByBox.get(box.id) ?? 0,
    owner: ownerByBox.get(box.id) ?? null,
  }));
}
