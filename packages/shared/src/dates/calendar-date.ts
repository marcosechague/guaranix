// Calendar dates travel as `YYYY-MM-DD` strings (Postgres `date`), so the
// arithmetic happens at UTC noon to stay clear of any offset or DST edge.

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcNoon(date: string): number {
  return Date.parse(`${date}T12:00:00Z`);
}

export function addDays(date: string, days: number): string {
  return new Date(toUtcNoon(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcNoon(to) - toUtcNoon(from)) / DAY_MS);
}

/** Days covered by an inclusive range, e.g. Monday to Sunday is 7. */
export function inclusiveDayCount(startsOn: string, endsOn: string): number {
  return daysBetween(startsOn, endsOn) + 1;
}

/** 0 = Sunday … 6 = Saturday, like Postgres `extract(dow)`. */
export function weekdayOf(date: string): number {
  return new Date(toUtcNoon(date)).getUTCDay();
}

/** The calendar date an instant falls on in a time zone, e.g. `America/Asuncion`. */
export function calendarDateIn(timeZone: string, instant: Date): string {
  // `en-CA` formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function rangesOverlap(
  first: { startsOn: string; endsOn: string },
  second: { startsOn: string; endsOn: string },
): boolean {
  return first.startsOn <= second.endsOn && second.startsOn <= first.endsOn;
}
