import { addDays, t } from '@guaranix/shared';

type Month = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12';

/** Booked spots over capacity, as a whole percentage. */
export function occupancyPercent(classes: readonly { takenSpots: number; capacity: number }[]) {
  const capacity = classes.reduce((total, item) => total + item.capacity, 0);
  if (capacity === 0) return 0;
  const taken = classes.reduce(
    (total, item) => total + Math.min(item.takenSpots, item.capacity),
    0,
  );
  return Math.round((taken / capacity) * 100);
}

/** First and last day of the month a date falls in, plus its name ("noviembre"). */
export function monthRange(date: string) {
  const from = `${date.slice(0, 7)}-01`;
  const nextMonth = addDays(from, 32).slice(0, 7);
  const to = addDays(`${nextMonth}-01`, -1);
  const name = t(`common.months.${String(Number(date.slice(5, 7))) as Month}`);
  return { from, to, name };
}
