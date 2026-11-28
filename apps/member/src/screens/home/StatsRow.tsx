import { t } from '@guaranix/shared';
import { Skeleton, StatTile } from '@guaranix/ui';
import { useMyBookings, useMyPlans, useMyRecords } from '../../api/queries';
import { currentPlanHealth } from '../../lib/plan-status';
import { useBoxClock } from '@guaranix/ui/data';

export function StatsRow() {
  const { today } = useBoxClock();
  const records = useMyRecords();
  const bookings = useMyBookings();
  const plans = useMyPlans();
  if (records.isPending || bookings.isPending || plans.isPending) {
    return (
      <div aria-busy="true" className="grid grid-cols-3 gap-3">
        <Skeleton className="h-22 rounded-xl" />
        <Skeleton className="h-22 rounded-xl" />
        <Skeleton className="h-22 rounded-xl" />
      </div>
    );
  }
  const month = today.slice(0, 7);
  const prsThisMonth = (records.data ?? []).filter((record) =>
    record.achievedOn.startsWith(month),
  ).length;
  const booked = (bookings.data ?? []).filter((item) => item.booking.status === 'booked').length;
  const health = currentPlanHealth(plans.data ?? [], today);
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatTile value={prsThisMonth} label={t('member.home.statPrs')} />
      <StatTile value={booked} label={t('member.home.statBooked')} />
      <StatTile
        value={health.kind === 'missing' ? 0 : health.daysLeft}
        label={t('member.home.statPlanDays')}
      />
    </div>
  );
}
