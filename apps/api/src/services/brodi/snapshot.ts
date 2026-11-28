import { addDays, calendarDateIn, formatGuarani, formatTimeIn } from '@guaranix/shared';
import { currentBox } from '../box-calendar';
import { listDebtors } from '../charges';
import { listClasses } from '../classes';
import type { ServiceContext } from '../context';
import { dashboard } from '../dashboard';
import { absentFor, activeMembers, expiringWithin } from './member-activity';

/** Lists are cut so the snapshot stays small; totals are always complete. */
const MAX_LISTED = 40;
/** "No viene hace…" covers the usual questions (7, 10, 14 days) and leaves room for more. */
const ABSENT_AFTER_DAYS = 7;
const EXPIRING_WITHIN_DAYS = 14;

type Dashboard = Awaited<ReturnType<typeof dashboard>>;

function period(figures: Dashboard) {
  return {
    from: figures.range.from,
    to: figures.range.to,
    collected: formatGuarani(figures.money.collectedGs),
    newMembers: figures.members.newMembers,
    lostMembers: figures.members.lostMembers,
    classesHeld: figures.classes.classes,
    attendedSpots: figures.classes.attended,
    occupancyPercent:
      figures.classes.occupancyRate === null
        ? null
        : Math.round(figures.classes.occupancyRate * 100),
  };
}

function firstOfMonth(date: string): string {
  return `${date.slice(0, 8)}01`;
}

/**
 * What Brodi knows about the box when it answers: figures from the same
 * services the panel uses, read in the caller's box scope and with the
 * caller's role. Names and amounts only; no ID numbers, phones or emails.
 */
export async function boxSnapshot(context: ServiceContext) {
  const box = await currentBox(context);
  const today = calendarDateIn(box.timezone, context.now);
  const monthStart = firstOfMonth(today);
  const lastMonthEnd = addDays(monthStart, -1);
  const thisMonth = await dashboard(context, { from: monthStart, to: today });
  const lastMonth = await dashboard(context, {
    from: firstOfMonth(lastMonthEnd),
    to: lastMonthEnd,
  });
  const lastSevenDays = await dashboard(context, { from: addDays(today, -6), to: today });
  const debtors = await listDebtors(context);
  const active = await activeMembers(context, box.timezone, today);
  const absent = absentFor(active, today, ABSENT_AFTER_DAYS);
  const expiring = expiringWithin(active, today, EXPIRING_WITHIN_DAYS);
  const todaysClasses = await listClasses(context, { from: today, to: today });
  return {
    box: { name: box.name, today, timeZone: box.timezone },
    thisMonth: period(thisMonth),
    lastMonth: period(lastMonth),
    lastSevenDays: period(lastSevenDays),
    money: {
      pendingReview: formatGuarani(thisMonth.money.pendingReviewGs),
      outstanding: formatGuarani(thisMonth.money.outstandingGs),
      overdue: formatGuarani(thisMonth.money.overdueGs),
    },
    activeMembers: active.length,
    debtors: {
      total: debtors.length,
      listed: debtors.slice(0, MAX_LISTED).map((debtor) => ({
        name: `${debtor.firstName} ${debtor.lastName}`.trim(),
        owed: formatGuarani(debtor.owedGs),
        daysOverdue: debtor.daysOverdue,
      })),
    },
    absentAtLeastSevenDays: { total: absent.length, listed: absent.slice(0, MAX_LISTED) },
    plansEndingInFourteenDays: { total: expiring.length, listed: expiring.slice(0, MAX_LISTED) },
    todaysClasses: todaysClasses.map((entry) => ({
      time: formatTimeIn(box.timezone, entry.startsAt),
      program: entry.programName,
      status: entry.status,
      booked: entry.takenSpots,
      capacity: entry.capacity,
      waitlist: entry.waitlistCount,
    })),
  };
}

export type BoxSnapshot = Awaited<ReturnType<typeof boxSnapshot>>;
