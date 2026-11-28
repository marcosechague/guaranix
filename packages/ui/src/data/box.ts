import { calendarDateIn } from '@guaranix/shared';
import type { CurrentBoxResponse } from '@guaranix/shared/api';
import { useQuery } from '@tanstack/react-query';
import { useApi } from './ApiProvider';

export const currentBoxKey = ['box'] as const;

export function useCurrentBox() {
  const api = useApi();
  return useQuery({
    queryKey: currentBoxKey,
    queryFn: () => api.get<CurrentBoxResponse>('/box/current'),
    staleTime: 10 * 60_000,
  });
}

const FALLBACK_TIME_ZONE = 'America/Asuncion';

/** Box time zone and today's date there; times on screen are always box-local. */
export function useBoxClock() {
  const { data } = useCurrentBox();
  const timeZone = data?.box?.timezone ?? FALLBACK_TIME_ZONE;
  return {
    timeZone,
    today: calendarDateIn(timeZone, new Date()),
    boxName: data?.box?.name,
    role: data?.role,
  };
}
