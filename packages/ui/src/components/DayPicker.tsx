import { classNames } from '../lib/class-names';

export interface DayOption {
  /** `YYYY-MM-DD` */
  value: string;
  weekday: string;
  day: number;
  /** Shows a small dot, e.g. a day where the member already booked. */
  marked?: boolean;
}

export interface DayPickerProps {
  label: string;
  days: readonly DayOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string | undefined;
}

/** A week as seven tappable days ("Vie 27"). */
export function DayPicker({ label, days, value, onChange, className }: DayPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={classNames('grid grid-cols-7 gap-1.5', className)}
    >
      {days.map((day) => {
        const selected = day.value === value;
        return (
          <button
            key={day.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(day.value)}
            className={classNames(
              'relative flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-md border',
              'transition-[transform,opacity] duration-fast ease-out active:scale-95',
              selected
                ? 'border-accent bg-accent text-on-accent'
                : 'border-border bg-surface text-text hover:border-text-secondary',
            )}
          >
            <span
              className={classNames(
                'text-micro font-semibold uppercase',
                selected ? 'text-on-accent' : 'text-text-secondary',
              )}
            >
              {day.weekday}
            </span>
            <span className="font-display text-lg leading-none font-bold tabular-nums">
              {day.day}
            </span>
            {day.marked ? (
              <span
                aria-hidden="true"
                className={classNames(
                  'absolute bottom-1.5 size-1 rounded-pill',
                  selected ? 'bg-on-accent' : 'bg-accent-strong',
                )}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
