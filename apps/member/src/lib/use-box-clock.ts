import { calendarDateIn } from '@guaranix/shared';
import { useCurrentBox } from '../api/queries';

const FALLBACK_TIME_ZONE = 'America/Asuncion';

/** Box time zone and today's date there; times on screen are always box-local. */
export function useBoxClock() {
  const { data } = useCurrentBox();
  const timeZone = data?.box?.timezone ?? FALLBACK_TIME_ZONE;
  return { timeZone, today: calendarDateIn(timeZone, new Date()), boxName: data?.box?.name };
}
