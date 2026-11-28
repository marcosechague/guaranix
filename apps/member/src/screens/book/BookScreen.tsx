import { addDays, dateOfInstant, formatTimeIn, relativeDayLabel, t } from '@guaranix/shared';
import type { ClassListItem, Plan } from '@guaranix/shared/api';
import { ChipGroup, EmptyState, Page, PageHeader, Skeleton, useToast } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { CalendarDays } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useBookClass } from '../../api/mutations';
import { useClasses, useMyPlans, usePlans } from '../../api/queries';
import { LoadError } from '../../layout/LoadError';
import { currentPlanHealth } from '../../lib/plan-status';
import { useBoxClock } from '../../lib/use-box-clock';
import { useNow } from '../../lib/use-now';
import { CancelBookingSheet, type CancelTarget } from './CancelBookingSheet';
import { type ClassAction, ClassRow } from './ClassRow';
import { DayStrip } from './DayStrip';

const DAYS_AHEAD = 7;
const ALL_PROGRAMS = 'all';

function planRule(plan: Plan): string {
  const count = plan.kind === 'weekly_limit' ? plan.classesPerWeek : plan.classCount;
  return t(`plans.rules.${plan.kind}`, { count: count ?? 0 });
}

function usePlanSubtitle(today: string): string {
  const memberPlans = useMyPlans();
  const plans = usePlans();
  const health = currentPlanHealth(memberPlans.data ?? [], today);
  if (memberPlans.isPending || plans.isPending) return '';
  if (health.kind === 'missing') return t('member.book.noPlanSubtitle');
  const plan = plans.data?.find((item) => item.id === health.plan.planId);
  return plan ? t('member.book.subtitle', { plan: plan.name, rule: planRule(plan) }) : '';
}

export function BookScreen() {
  const { timeZone, today } = useBoxClock();
  const days = useMemo(
    () => Array.from({ length: DAYS_AHEAD }, (_, index) => addDays(today, index)),
    [today],
  );
  const lastDay = days[days.length - 1] ?? today;
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [program, setProgram] = useState<string>(ALL_PROGRAMS);
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const classes = useClasses(today, lastDay);
  const now = useNow();
  const book = useBookClass();
  const toast = useToast();
  const subtitle = usePlanSubtitle(today);

  // Classes that already started are noise when booking: only what's still ahead.
  const all = (classes.data ?? []).filter((item) => Date.parse(item.startsAt) > now);
  const firstOpenDay = all[0] ? dateOfInstant(timeZone, all[0].startsAt) : today;
  const selectedDay = pickedDay ?? firstOpenDay;
  const programs = [...new Map(all.map((item) => [item.programId, item.programName])).entries()];
  const markedDays = new Set(
    all
      .filter((item) => item.ownBooking && item.status !== 'cancelled')
      .map((item) => dateOfInstant(timeZone, item.startsAt)),
  );
  const visible = all.filter(
    (item) =>
      dateOfInstant(timeZone, item.startsAt) === selectedDay &&
      (program === ALL_PROGRAMS || item.programId === program),
  );

  const onAction = (item: ClassListItem, action: ClassAction) => {
    const time = formatTimeIn(timeZone, item.startsAt);
    if (action === 'cancel' && item.ownBooking) {
      setCancelTarget({
        bookingId: item.ownBooking.id,
        status: item.ownBooking.status,
        waitlistPosition: item.ownBooking.waitlistPosition,
        day: relativeDayLabel(selectedDay, today),
        time,
        program: item.programName,
      });
      return;
    }
    book.mutate(item.id, {
      onSuccess: (booking) =>
        toast.show(
          booking.status === 'waitlisted'
            ? t('member.book.waitlistedToast', { position: booking.waitlistPosition ?? 1 })
            : t('member.book.bookedToast', { time }),
        ),
      onError: (error) => toast.show(errorText(error), 'error'),
    });
  };

  return (
    <Page layout="mobile" className="gap-4">
      <PageHeader size="large" title={t('member.book.title')} subtitle={subtitle} />
      <DayStrip
        days={days}
        selected={selectedDay}
        onSelect={setPickedDay}
        markedDays={markedDays}
      />
      {programs.length > 1 ? (
        <ChipGroup
          label={t('member.book.programs')}
          value={program}
          onChange={setProgram}
          options={[
            { value: ALL_PROGRAMS, label: t('common.all') },
            ...programs.map(([value, label]) => ({ value, label })),
          ]}
        />
      ) : null}
      {classes.isPending ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-18 rounded-xl" />
          ))}
        </div>
      ) : classes.isError ? (
        <LoadError error={classes.error} onRetry={() => void classes.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          framed
          icon={CalendarDays}
          title={
            selectedDay === today ? t('member.book.noneLeftTitle') : t('member.book.emptyTitle')
          }
          description={t('member.book.emptyBody')}
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {visible.map((item) => (
            <ClassRow
              key={item.id}
              item={item}
              timeZone={timeZone}
              now={now}
              busy={book.isPending && book.variables === item.id}
              onAction={onAction}
            />
          ))}
        </ul>
      )}
      <CancelBookingSheet
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        target={cancelTarget}
      />
    </Page>
  );
}
