import { addDays, startOfWeek } from '@guaranix/shared';
import type { ClassListItem } from '@guaranix/shared/api';
import { dateOfInstant } from '@guaranix/shared';

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function shiftWeek(weekStart: string, weeks: number): string {
  return startOfWeek(addDays(weekStart, weeks * 7));
}

/** Classes keyed by their local calendar date in the box's time zone. */
export function groupByDay(
  classes: readonly ClassListItem[],
  timeZone: string,
): Map<string, ClassListItem[]> {
  const byDay = new Map<string, ClassListItem[]>();
  for (const item of classes) {
    const day = dateOfInstant(timeZone, item.startsAt);
    byDay.set(day, [...(byDay.get(day) ?? []), item]);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return byDay;
}
