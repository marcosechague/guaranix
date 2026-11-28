import { formatTimeIn, t } from '@guaranix/shared';
import type { ClassListItem } from '@guaranix/shared/api';
import { Button, classNames, ColorDot, ProgressBar } from '@guaranix/ui';
import { Check, Clock } from 'lucide-react';
import { motion } from 'motion/react';

export type ClassAction = 'book' | 'cancel';

export interface ClassRowProps {
  item: ClassListItem;
  timeZone: string;
  now: number;
  busy: boolean;
  /** Name the location, when the list mixes several. */
  showLocation?: boolean;
  onAction: (item: ClassListItem, action: ClassAction) => void;
}

function ActionButton({
  item,
  now,
  busy,
  onAction,
}: Omit<ClassRowProps, 'timeZone' | 'showLocation'>) {
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
        className="min-w-28 shrink-0 border-success/40 px-3.5 text-success"
        disabled={busy}
        onClick={() => onAction(item, 'cancel')}
      >
        <Check aria-hidden="true" size={18} />
        {t('member.book.booked')}
      </Button>
    );
  }
  if (own?.status === 'waitlisted') {
    const position = own.waitlistPosition ?? 1;
    return (
      <Button
        variant="secondary"
        className="min-w-20 px-3.5 text-warning"
        aria-label={t('member.book.waitlisted', { position })}
        disabled={busy}
        onClick={() => onAction(item, 'cancel')}
      >
        <Clock aria-hidden="true" size={18} />
        {t('member.book.waitlistedShort', { position })}
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
  const { item, timeZone, now, showLocation = false, ...actionProps } = props;
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
        <span className="flex min-w-0 items-center gap-2 font-semibold">
          <ColorDot color={item.programColor} />
          <span className="truncate">{item.programName}</span>
        </span>
        {showLocation ? (
          <span className="-mt-1 truncate text-xs text-text-secondary">{item.locationName}</span>
        ) : null}
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
      <div className="shrink-0">
        <ActionButton item={item} now={now} {...actionProps} />
      </div>
    </motion.li>
  );
}
