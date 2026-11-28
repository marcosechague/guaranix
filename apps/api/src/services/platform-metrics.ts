import { boxes, members, platformPlans } from '@guaranix/db/schema';
import type { PlatformMetrics } from '@guaranix/shared';
import { and, count, eq, ne } from 'drizzle-orm';
import { monthlyFeeGs } from './platform-boxes';
import type { PlatformContext } from './platform-context';

const SOON_MS = 7 * 24 * 60 * 60 * 1000;

/** First instant of the current month in Asunción, where every pilot is. */
function startOfMonth(now: Date): Date {
  const [year, month] = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
  })
    .format(now)
    .split('-')
    .map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1, 3));
}

/** MRR counts paying (active) boxes only; trials are shown apart as potential revenue. */
export async function platformMetrics(context: PlatformContext): Promise<PlatformMetrics> {
  const [rows, [memberTotal]] = await Promise.all([
    context.transaction
      .select({
        status: boxes.status,
        trialEndsAt: boxes.trialEndsAt,
        createdAt: boxes.createdAt,
        extraLocations: boxes.extraLocations,
        monthlyPriceGs: platformPlans.monthlyPriceGs,
        extraLocationMonthlyPriceGs: platformPlans.extraLocationMonthlyPriceGs,
      })
      .from(boxes)
      .leftJoin(platformPlans, eq(platformPlans.id, boxes.platformPlanId)),
    context.transaction
      .select({ total: count() })
      .from(members)
      .innerJoin(boxes, eq(boxes.id, members.boxId))
      .where(and(eq(members.status, 'active'), ne(boxes.status, 'cancelled'))),
  ]);

  const monthStart = startOfMonth(context.now);
  const soon = new Date(context.now.getTime() + SOON_MS);
  const metrics: PlatformMetrics = {
    mrrGs: 0,
    trialMrrGs: 0,
    boxes: {
      active: 0,
      trial: 0,
      suspended: 0,
      cancelled: 0,
      trialEndingSoon: 0,
      createdThisMonth: 0,
      withExtraLocations: 0,
    },
    activeMembers: memberTotal?.total ?? 0,
  };
  for (const row of rows) {
    metrics.boxes[row.status] += 1;
    const fee = monthlyFeeGs(
      row.monthlyPriceGs === null
        ? null
        : {
            monthlyPriceGs: row.monthlyPriceGs,
            extraLocationMonthlyPriceGs: row.extraLocationMonthlyPriceGs ?? 0,
          },
      row.extraLocations,
    );
    if (row.status === 'active') metrics.mrrGs += fee;
    if (row.status === 'trial') {
      metrics.trialMrrGs += fee;
      if (row.trialEndsAt && row.trialEndsAt <= soon) metrics.boxes.trialEndingSoon += 1;
    }
    if (row.createdAt >= monthStart) metrics.boxes.createdThisMonth += 1;
    if (row.status !== 'cancelled' && row.extraLocations > 0) metrics.boxes.withExtraLocations += 1;
  }
  return metrics;
}
