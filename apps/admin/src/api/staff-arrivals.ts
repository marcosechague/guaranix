import type { CheckInPassView, StaffArrivalView } from '@guaranix/shared/schemas';
import { useApi } from '@guaranix/ui/data';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './keys';

/** The coach's or receptionist's own entrance QR, asked for again well before it expires. */
export function useStaffPass() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.staffPass,
    queryFn: async () =>
      (await api.get<{ pass: CheckInPassView }>('/box/check-ins/staff-pass')).pass,
    refetchInterval: 45_000,
    refetchIntervalInBackground: false,
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  });
}

/** Who of the staff scanned in on a box day, first come first. */
export function useStaffArrivals(date: string, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: [...queryKeys.staffArrivals, date],
    queryFn: async () =>
      (await api.get<{ arrivals: StaffArrivalView[] }>('/box/check-ins/staff-arrivals', { date }))
        .arrivals,
    enabled,
    refetchInterval: 60_000,
  });
}
