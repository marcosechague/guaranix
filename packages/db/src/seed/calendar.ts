/**
 * Paraguay has stayed on UTC-3 all year since October 2024 (Ley 7.354), so seeds
 * can build local times with a fixed offset instead of a time zone library.
 */
const ASUNCION_OFFSET = '-03:00';
const DAY_MS = 24 * 60 * 60 * 1000;

export function localDate(daysFromToday = 0, now = new Date()): string {
  const local = new Date(now.getTime() - 3 * 60 * 60 * 1000 + daysFromToday * DAY_MS);
  return local.toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function localDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time.slice(0, 5)}:00${ASUNCION_OFFSET}`);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}
