import { CHECK_IN_OPENS_MINUTES_BEFORE } from '@guaranix/shared';
import type { ClassListItem } from '@guaranix/shared/api';

const MINUTE_MS = 60_000;

/** Same window as the API: "came" from 30 minutes before, "didn't come" once it started. */
export function attendanceWindow(item: ClassListItem | null, now: number) {
  if (!item) return { open: false, started: false, ended: false };
  const startsAt = Date.parse(item.startsAt);
  return {
    open: now >= startsAt - CHECK_IN_OPENS_MINUTES_BEFORE * MINUTE_MS,
    started: now >= startsAt,
    ended: now >= Date.parse(item.endsAt),
  };
}
