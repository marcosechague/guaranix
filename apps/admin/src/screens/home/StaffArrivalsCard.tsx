import { formatTimeIn, t } from '@guaranix/shared';
import { Avatar, Card, CardList, CardListItem, Skeleton } from '@guaranix/ui';
import { LoadError, useBoxClock } from '@guaranix/ui/data';
import { useStaffArrivals } from '../../api/staff-arrivals';

/** Which coaches and receptionists already scanned in today, for the owner to see at a glance. */
export function StaffArrivalsCard() {
  const { today, timeZone } = useBoxClock();
  const arrivals = useStaffArrivals(today, true);
  return (
    <Card>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold">{t('admin.home.staffArrivals')}</h2>
        <p className="text-sm text-text-secondary">{t('admin.home.staffArrivalsHint')}</p>
      </div>
      {arrivals.isPending ? (
        <Skeleton className="h-16" />
      ) : arrivals.isError ? (
        <LoadError error={arrivals.error} onRetry={() => void arrivals.refetch()} />
      ) : arrivals.data.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('admin.home.noStaffArrivals')}</p>
      ) : (
        <CardList>
          {arrivals.data.map((arrival) => {
            const [firstName = '', ...rest] = arrival.fullName.split(' ');
            return (
              <CardListItem key={arrival.userId}>
                <Avatar firstName={firstName} lastName={rest.join(' ')} size="sm" />
                <span className="min-w-0 flex-1 truncate font-semibold">{arrival.fullName}</span>
                <span className="shrink-0 text-sm text-text-secondary tabular-nums">
                  {formatTimeIn(timeZone, arrival.arrivedAt)}
                </span>
              </CardListItem>
            );
          })}
        </CardList>
      )}
    </Card>
  );
}
