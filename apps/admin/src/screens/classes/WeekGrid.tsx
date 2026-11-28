import { dayOfMonth, t, weekdayShort } from '@guaranix/shared';
import type { ClassListItem } from '@guaranix/shared/api';
import { classNames } from '@guaranix/ui';
import { ClassTile } from './ClassTile';

export interface WeekGridProps {
  days: readonly string[];
  today: string;
  /** On phones only the selected day is shown; desktops see the whole week. */
  selectedDay: string;
  byDay: Map<string, ClassListItem[]>;
  timeZone: string;
  onOpen: (classId: string) => void;
}

export function WeekGrid({ days, today, selectedDay, byDay, timeZone, onOpen }: WeekGridProps) {
  return (
    <div className="grid gap-3 lg:grid-cols-7">
      {days.map((day) => {
        const classes = byDay.get(day) ?? [];
        return (
          <section
            key={day}
            aria-label={`${weekdayShort(day)} ${dayOfMonth(day)}`}
            className={classNames(
              'flex min-w-0 flex-col gap-2',
              day === selectedDay ? 'flex' : 'hidden lg:flex',
            )}
          >
            <h2
              className={classNames(
                'hidden items-baseline gap-1.5 px-1 lg:flex',
                day === today ? 'text-accent-text' : 'text-text-secondary',
              )}
            >
              <span className="text-xs font-semibold tracking-widest uppercase">
                {weekdayShort(day)}
              </span>
              <span className="font-display text-lg font-bold text-text">{dayOfMonth(day)}</span>
            </h2>
            {classes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-3 text-sm text-text-secondary">
                {t('admin.classes.noClasses')}
              </p>
            ) : (
              classes.map((item) => (
                <ClassTile
                  key={item.id}
                  item={item}
                  timeZone={timeZone}
                  onOpen={() => onOpen(item.id)}
                />
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}
