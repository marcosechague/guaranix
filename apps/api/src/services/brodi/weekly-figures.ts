import { addDays, type BrodiWeeklyFigures, formatGuarani, t } from '@guaranix/shared';
import { currentBox } from '../box-calendar';
import { listDebtors } from '../charges';
import type { ServiceContext } from '../context';
import { dashboard } from '../dashboard';
import { activeMembers } from './member-activity';

/** Monday-to-Sunday figures for the week starting `weekStart`; money owed is as of today. */
export async function weeklyFigures(
  context: ServiceContext,
  weekStart: string,
  today: string,
): Promise<BrodiWeeklyFigures> {
  const box = await currentBox(context);
  const week = await dashboard(context, { from: weekStart, to: addDays(weekStart, 6) });
  const debtors = await listDebtors(context);
  const active = await activeMembers(context, box.timezone, today);
  return {
    collectedGs: week.money.collectedGs,
    overdueGs: week.money.overdueGs,
    debtors: debtors.length,
    activeMembers: active.length,
    newMembers: week.members.newMembers,
    lostMembers: week.members.lostMembers,
    classes: week.classes.classes,
    attended: week.classes.attended,
    occupancyRate: week.classes.occupancyRate,
    absentMembers: active.filter(
      (member) => member.lastVisitOn === null || member.lastVisitOn < weekStart,
    ).length,
  };
}

/** The summary in fixed words, when the AI is out of uses or does not answer. */
export function templateSummary(figures: BrodiWeeklyFigures): string {
  const lines = [
    t('brodi.weekly.collected', { amount: formatGuarani(figures.collectedGs) }),
    figures.occupancyRate === null
      ? t('brodi.weekly.noClasses')
      : t('brodi.weekly.classes', {
          classes: figures.classes,
          occupancy: Math.round(figures.occupancyRate * 100),
        }),
    t('brodi.weekly.members', {
      active: figures.activeMembers,
      joined: figures.newMembers,
      left: figures.lostMembers,
    }),
  ];
  if (figures.absentMembers > 0) {
    lines.push(t('brodi.weekly.absent', { count: figures.absentMembers }));
  }
  lines.push(
    figures.debtors === 0
      ? t('brodi.weekly.noDebt')
      : t('brodi.weekly.debt', {
          amount: formatGuarani(figures.overdueGs),
          count: figures.debtors,
        }),
  );
  return lines.join(' ');
}
