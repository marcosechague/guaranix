import { formatGuarani, t } from '@guaranix/shared';
import { Skeleton, StatTile } from '@guaranix/ui';
import { LoadError, useBoxClock } from '@guaranix/ui/data';
import { useClasses, useDashboard, useMemberCount } from '../../api/queries';
import { monthRange, occupancyPercent } from '../../lib/occupancy';

function KpiSkeleton() {
  return (
    <div aria-busy="true" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

/** Owners see the month's money; coaches and reception see today's floor. */
export function KpiRow({ showMoney }: { showMoney: boolean }) {
  const { today } = useBoxClock();
  const month = monthRange(today);
  const dashboard = useDashboard(month.from, month.to, showMoney);
  const members = useMemberCount();
  const classes = useClasses(today, today);

  if (showMoney) {
    if (dashboard.isError && !dashboard.data) {
      return <LoadError error={dashboard.error} onRetry={() => void dashboard.refetch()} />;
    }
    if (!dashboard.data) return <KpiSkeleton />;
    const { money, members: people, classes: occupancy } = dashboard.data;
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          labelFirst
          size="md"
          label={t('admin.home.collected', { month: month.name })}
          value={formatGuarani(money.collectedGs)}
          hint={
            money.pendingReviewGs > 0
              ? t('admin.home.pendingReview', { amount: formatGuarani(money.pendingReviewGs) })
              : undefined
          }
        />
        <StatTile
          labelFirst
          size="md"
          label={t('admin.home.outstanding')}
          value={formatGuarani(money.outstandingGs)}
          hint={
            money.overdueGs > 0 ? (
              <span className="font-semibold text-warning">
                {t('admin.home.overdue', { amount: formatGuarani(money.overdueGs) })}
              </span>
            ) : undefined
          }
        />
        <StatTile
          labelFirst
          size="md"
          label={t('admin.home.activeMembers')}
          value={people.activeMembers}
          hint={t('admin.home.newMembers', { count: people.newMembers })}
        />
        <StatTile
          labelFirst
          size="md"
          label={t('admin.home.monthOccupancy')}
          value={
            occupancy.occupancyRate === null ? '—' : `${Math.round(occupancy.occupancyRate * 100)}%`
          }
          hint={
            occupancy.occupancyRate === null
              ? t('admin.home.noOccupancy')
              : t('admin.home.attended', { count: occupancy.attended })
          }
        />
      </div>
    );
  }

  const failed = [classes, members].find((query) => query.isError && query.data === undefined);
  if (failed) return <LoadError error={failed.error} onRetry={() => void failed.refetch()} />;
  if (!classes.data || members.data === undefined) return <KpiSkeleton />;
  const todays = classes.data.filter((item) => item.status === 'scheduled');
  const bookings = todays.reduce((total, item) => total + item.takenSpots, 0);
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile labelFirst size="md" label={t('admin.home.activeMembers')} value={members.data} />
      <StatTile labelFirst size="md" label={t('admin.home.classesToday')} value={todays.length} />
      <StatTile labelFirst size="md" label={t('admin.home.bookingsToday')} value={bookings} />
      <StatTile
        labelFirst
        size="md"
        label={t('admin.home.occupancy')}
        value={`${occupancyPercent(todays)}%`}
      />
    </div>
  );
}
