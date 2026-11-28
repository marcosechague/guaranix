import { dayOfMonth, t, weekdayShort } from '@guaranix/shared';
import { classNames } from '@guaranix/ui';

export interface DayStripProps {
  days: readonly string[];
  selected: string;
  onSelect: (date: string) => void;
  /** Dates where the member already has a booking get a small dot. */
  markedDays: ReadonlySet<string>;
}

export function DayStrip({ days, selected, onSelect, markedDays }: DayStripProps) {
  return (
    <div role="radiogroup" aria-label={t('member.book.days')} className="grid grid-cols-7 gap-1.5">
      {days.map((date) => {
        const isSelected = date === selected;
        return (
          <button
            key={date}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(date)}
            className={classNames(
              'relative flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-md border',
              'transition-[transform,opacity] duration-fast ease-out active:scale-[0.95]',
              isSelected
                ? 'border-accent bg-accent text-on-accent'
                : 'border-border bg-surface text-text hover:border-text-secondary',
            )}
          >
            <span
              className={classNames(
                'text-[11px] font-semibold uppercase',
                isSelected ? 'text-on-accent' : 'text-text-secondary',
              )}
            >
              {weekdayShort(date)}
            </span>
            <span className="font-display text-lg leading-none font-bold tabular-nums">
              {dayOfMonth(date)}
            </span>
            {markedDays.has(date) ? (
              <span
                aria-hidden="true"
                className={classNames(
                  'absolute bottom-1.5 size-1 rounded-pill',
                  isSelected ? 'bg-on-accent' : 'bg-accent',
                )}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
