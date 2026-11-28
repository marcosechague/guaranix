import { dayOfMonth, t, weekdayShort } from '@guaranix/shared';
import { DayPicker } from '@guaranix/ui';

export interface DayStripProps {
  days: readonly string[];
  selected: string;
  onSelect: (date: string) => void;
  /** Dates where the member already has a booking get a small dot. */
  markedDays: ReadonlySet<string>;
}

export function DayStrip({ days, selected, onSelect, markedDays }: DayStripProps) {
  return (
    <DayPicker
      label={t('member.book.days')}
      value={selected}
      onChange={onSelect}
      days={days.map((date) => ({
        value: date,
        weekday: weekdayShort(date),
        day: dayOfMonth(date),
        marked: markedDays.has(date),
      }))}
    />
  );
}
