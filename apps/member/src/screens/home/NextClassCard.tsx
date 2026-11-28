import { dateOfInstant, formatTimeIn, relativeDayLabel, t } from '@guaranix/shared';
import { Badge, Button, Card, EmptyState, Eyebrow, ProgressBar, Skeleton } from '@guaranix/ui';
import { Link } from 'react-router';
import { useState } from 'react';
import { useClasses, useMyBookings } from '../../api/queries';
import { useBoxClock } from '../../lib/use-box-clock';
import { CancelBookingSheet } from '../book/CancelBookingSheet';

export function NextClassCard() {
  const { timeZone, today } = useBoxClock();
  const bookings = useMyBookings();
  const next = bookings.data?.[0];
  const classDate = next ? dateOfInstant(timeZone, next.class.startsAt) : today;
  // The list endpoint carries the program name and how full the class is.
  const classes = useClasses(classDate, classDate, next !== undefined);
  const details = classes.data?.find((item) => item.id === next?.class.id);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (bookings.isPending) {
    return (
      <Card aria-busy="true" className="flex flex-col gap-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-12 w-40" />
        <Skeleton className="h-1.5" />
        <Skeleton className="h-11" />
      </Card>
    );
  }

  if (!next) {
    return (
      <Card className="flex flex-col gap-4">
        <Eyebrow>{t('member.home.nextClass')}</Eyebrow>
        <EmptyState
          title={t('member.home.emptyNextClassTitle')}
          description={t('member.home.emptyNextClass')}
          action={
            <Button asChild>
              <Link to="/reservar">{t('member.home.bookClass')}</Link>
            </Button>
          }
        />
      </Card>
    );
  }

  const isWaitlisted = next.booking.status === 'waitlisted';
  const time = formatTimeIn(timeZone, next.class.startsAt);
  const day = relativeDayLabel(classDate, today);
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>{t('member.home.nextClass')}</Eyebrow>
        {isWaitlisted ? (
          <Badge tone="warning" dot>
            {t('member.home.waitlisted', { position: next.booking.waitlistPosition ?? 1 })}
          </Badge>
        ) : (
          <Badge tone="success" dot>
            {t('member.home.confirmed')}
          </Badge>
        )}
      </div>
      <div className="flex items-end gap-4">
        <span className="font-display text-6xl leading-none font-bold tracking-tight tabular-nums">
          {time}
        </span>
        <span className="pb-1 text-text-soft">
          {t('member.home.classMeta', { day, program: details?.programName ?? '' })}
        </span>
      </div>
      {details ? (
        <div className="flex items-center gap-3">
          <ProgressBar
            className="flex-1"
            value={details.takenSpots}
            max={details.capacity}
            label={t('common.spotsLabel')}
          />
          <span className="text-sm text-text-secondary tabular-nums">
            {t('common.spots', { taken: details.takenSpots, capacity: details.capacity })}
          </span>
        </div>
      ) : (
        <Skeleton className="h-1.5" />
      )}
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Button asChild className="bg-text text-background hover:bg-text-soft">
          <Link to="/wod">{t('member.home.seeWod')}</Link>
        </Button>
        <Button variant="secondary" onClick={() => setCancelOpen(true)}>
          {t('common.cancel')}
        </Button>
      </div>
      <CancelBookingSheet
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        target={{
          bookingId: next.booking.id,
          status: next.booking.status,
          waitlistPosition: next.booking.waitlistPosition,
          day,
          time,
          program: details?.programName ?? '',
        }}
      />
    </Card>
  );
}
