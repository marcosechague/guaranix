import { formatTimeIn, t } from '@guaranix/shared';
import type { ClassListItem } from '@guaranix/shared/api';
import { Button, classNames, ProgressBar } from '@guaranix/ui';
import { Check, Clock } from 'lucide-react';
import { motion } from 'motion/react';

export type ClassAction = 'book' | 'cancel';

export interface ClassRowProps {
  item: ClassListItem;
  timeZone: string;
  now: number;
  busy: boolean;
  onAction: (item: ClassListItem, action: ClassAction) => void;
}

function ActionButton({ item, now, busy, onAction }: Omit<ClassRowProps, 'timeZone'>) {
  const own = item.ownBooking;
  const started = Date.parse(item.startsAt) <= now;
  if (item.status === 'cancelled') {
    return (
      <span className="text-sm font-semibold text-warning">{t('member.book.cancelledClass')}</span>
    );
  }
  if (started) {
    return <span className="text-sm text-text-secondary">{t('member.book.past')}</span>;
  }
  if (own?.status === 'booked') {
    return (
      <Button
        variant="secondary"
        className="min-w-28 px-3.5 border-success/40 text-success"
        disabled={busy}
        onClick={() => onAction(item, 'cancel')}
      >
        <Check aria-hidden="true" size={18} />
        {t('member.book.booked')}
      </Button>
    );
  }
  if (own?.status === 'waitlisted') {
    return (
      <Button
        variant="secondary"
        className="min-w-28 px-3.5 text-warning"
        disabled={busy}
        onClick={() => onAction(item, 'cancel')}
      >
        <Clock aria-hidden="true" size={18} />
        {t('member.book.waitlisted', { position: own.waitlistPosition ?? 1 })}
      </Button>
    );
  }
  const full = item.spotsLeft === 0;
  return (
    <Button
      variant={full ? 'secondary' : 'primary'}
      className="min-w-28 px-3.5"
      disabled={busy}
      onClick={() => onAction(item, 'book')}
    >
      {full ? t('member.book.joinWaitlist') : t('member.book.book')}
    </Button>
  );
}

export function ClassRow(props: ClassRowProps) {
  const { item, timeZone, now } = props;
  const muted = item.status === 'cancelled' || Date.parse(item.startsAt) <= now;
  const full = item.spotsLeft === 0;
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={classNames(
        'flex items-center gap-3 rounded-xl border bg-surface py-3.5 pr-3 pl-4',
        item.ownBooking?.status === 'booked' ? 'border-success/40' : 'border-border',
        muted && 'opacity-60',
      )}
    >
      <span className="w-15 shrink-0 font-display text-2xl font-bold tabular-nums">
        {formatTimeIn(timeZone, item.startsAt)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-center gap-2 truncate font-semibold">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-pill"
            style={{ backgroundColor: item.programColor }}
          />
          {item.programName}
        </span>
        <div className="flex items-center gap-2">
          <ProgressBar
            className="w-10 shrink-0"
            value={item.takenSpots}
            max={item.capacity}
            label={t('common.spotsLabel')}
            tone={full ? 'warning' : 'accent'}
          />
          <span className="text-xs whitespace-nowrap text-text-secondary tabular-nums">
            {full && item.waitlistCount > 0
              ? t('member.book.full', { count: item.waitlistCount })
              : t('common.spots', { taken: item.takenSpots, capacity: item.capacity })}
          </span>
        </div>
      </div>
      <ActionButton {...props} />
    </motion.li>
  );
}
