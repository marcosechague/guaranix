import { formatTimeIn, t } from '@guaranix/shared';
import { Badge, Button, Card, ColorDot, EmptyState, ProgressBar, Skeleton } from '@guaranix/ui';
import { LoadError, useBoxClock } from '@guaranix/ui/data';
import { CalendarDays } from 'lucide-react';
import { Link } from 'react-router';
import { useClasses } from '../../api/queries';
import { occupancyPercent } from '../../lib/occupancy';

export function TodayClassesCard({ className }: { className?: string }) {
  const { today, timeZone } = useBoxClock();
  const classes = useClasses(today, today);
  const scheduled = (classes.data ?? []).filter((item) => item.status === 'scheduled');
  const bookings = scheduled.reduce((total, item) => total + item.takenSpots, 0);
  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-bold">{t('admin.home.todayClasses')}</h2>
          {classes.data ? (
            <p className="text-sm text-text-secondary">
              {t('admin.home.classesTodayHint', {
                bookings,
                occupancy: occupancyPercent(scheduled),
              })}
            </p>
          ) : null}
        </div>
        <Button asChild variant="ghost" className="-mt-2 -mr-2 text-sm">
          <Link to="/clases">{t('admin.home.seeAll')}</Link>
        </Button>
      </div>
      {classes.isPending ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-12" />
          ))}
        </div>
      ) : classes.isError ? (
        <LoadError error={classes.error} onRetry={() => void classes.refetch()} />
      ) : scheduled.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={t('admin.home.noClassesToday')}
          description={t('admin.classes.noClasses')}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-divider">
          {scheduled.map((item) => (
            <li key={item.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
              <span className="w-14 shrink-0 font-display text-lg font-bold tabular-nums">
                {formatTimeIn(timeZone, item.startsAt)}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2 font-medium">
                <ColorDot color={item.programColor} />
                <span className="truncate">{item.programName}</span>
              </span>
              {item.waitlistCount > 0 ? (
                <Badge tone="warning">
                  {t('admin.home.waitlist', { count: item.waitlistCount })}
                </Badge>
              ) : null}
              <ProgressBar
                className="hidden w-32 sm:block"
                value={item.takenSpots}
                max={item.capacity}
                label={t('common.spotsLabel')}
                tone={item.spotsLeft === 0 ? 'warning' : 'accent'}
              />
              <span className="w-14 text-right text-sm text-text-secondary tabular-nums">
                {t('admin.classes.bookedCount', {
                  taken: item.takenSpots,
                  capacity: item.capacity,
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
