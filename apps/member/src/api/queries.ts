import type {
  ClassListItem,
  Leaderboard,
  Member,
  MemberPlan,
  OwnAccount,
  OwnBooking,
  PersonalRecord,
  Workout,
} from '@guaranix/shared/api';
import { useApi } from '@guaranix/ui/data';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './keys';

export function useMe() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => (await api.get<{ member: Member }>('/box/me')).member,
    staleTime: 10 * 60_000,
  });
}

export function useMyPlans() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.myPlans,
    queryFn: async () => (await api.get<{ plans: MemberPlan[] }>('/box/me/plans')).plans,
  });
}

export function useMyBookings() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.myBookings,
    queryFn: async () => (await api.get<{ bookings: OwnBooking[] }>('/box/me/bookings')).bookings,
  });
}

export function useMyRecords() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.myRecords,
    queryFn: async () => (await api.get<{ records: PersonalRecord[] }>('/box/me/records')).records,
  });
}

export function useClasses(from: string, to: string, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.classes(from, to),
    queryFn: async () =>
      (await api.get<{ classes: ClassListItem[] }>('/box/classes', { from, to })).classes,
    enabled,
  });
}

export function useWorkouts(date: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.workouts(date ?? ''),
    queryFn: async () =>
      (await api.get<{ workouts: Workout[] }>('/box/workouts', { date })).workouts,
    enabled: date !== undefined,
  });
}

export function useLeaderboard(componentId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.leaderboard(componentId ?? ''),
    queryFn: () => api.get<Leaderboard>(`/box/components/${componentId}/leaderboard`),
    enabled: componentId !== undefined,
    refetchInterval: 60_000,
  });
}

export { useMovements, usePlans, usePrograms } from '@guaranix/ui/data';

export function useMyAccount() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.myAccount,
    queryFn: () => api.get<OwnAccount>('/box/me/account'),
  });
}
