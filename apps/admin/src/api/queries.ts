import type { BookingPolicy } from '@guaranix/shared/schemas';
import type {
  Charge,
  ClassListItem,
  ClassSchedule,
  ClassSession,
  DashboardReport,
  Debtor,
  Member,
  Payment,
  MemberPlan,
  PersonalRecord,
  RosterEntry,
  Workout,
} from '@guaranix/shared/api';
import type { MemberStatus } from '@guaranix/shared/domain';
import { useApi } from '@guaranix/ui/data';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from './keys';

export function useMemberCount() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.memberCount,
    queryFn: async () => (await api.get<{ total: number }>('/box/members/count')).total,
  });
}

export function useMembers(search: string, status: MemberStatus | 'all') {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.members(search, status),
    queryFn: async () =>
      (
        await api.get<{ members: Member[] }>('/box/members', {
          search: search || undefined,
          status: status === 'all' ? undefined : status,
          limit: 100,
        })
      ).members,
    placeholderData: keepPreviousData,
  });
}

export function useMemberPlans(memberId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.memberPlans(memberId ?? ''),
    queryFn: async () =>
      (await api.get<{ plans: MemberPlan[] }>(`/box/members/${memberId}/plans`)).plans,
    enabled: memberId !== null,
  });
}

export function useMemberRecords(memberId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.memberRecords(memberId ?? ''),
    queryFn: async () =>
      (await api.get<{ records: PersonalRecord[] }>(`/box/members/${memberId}/records`)).records,
    enabled: memberId !== null,
  });
}

export function useClasses(from: string, to: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.classes(from, to),
    queryFn: async () =>
      (await api.get<{ classes: ClassListItem[] }>('/box/classes', { from, to })).classes,
    placeholderData: keepPreviousData,
  });
}

export function useRoster(classId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.roster(classId ?? ''),
    queryFn: () =>
      api.get<{ class: ClassSession; roster: RosterEntry[] }>(`/box/classes/${classId}/roster`),
    enabled: classId !== null,
  });
}

export function useWorkouts(date: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.workouts(date),
    queryFn: async () =>
      (await api.get<{ workouts: Workout[] }>('/box/workouts', { date })).workouts,
  });
}

export function useDashboard(from: string, to: string, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.dashboard(from, to),
    queryFn: () => api.get<DashboardReport>('/box/reports/dashboard', { from, to }),
    enabled,
  });
}

export function useDebtors(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.debtors,
    queryFn: async () => (await api.get<{ debtors: Debtor[] }>('/box/reports/debtors')).debtors,
    enabled,
  });
}

export function useMember(memberId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.member(memberId ?? ''),
    queryFn: async () => (await api.get<{ member: Member }>(`/box/members/${memberId}`)).member,
    enabled: memberId !== null,
  });
}

export function useBookingPolicy() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.bookingPolicy,
    queryFn: async () => (await api.get<{ policy: BookingPolicy }>('/box/settings/booking')).policy,
  });
}

export function useSchedules() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.schedules,
    queryFn: async () =>
      (await api.get<{ schedules: ClassSchedule[] }>('/box/schedules')).schedules,
  });
}

/** Payments recorded between two instants (box-local month bounds), newest first. */
export function usePayments(from: string, to: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.payments(from, to),
    queryFn: async () =>
      (await api.get<{ payments: Payment[] }>('/box/payments', { from, to })).payments,
  });
}

export function usePaymentsToReview() {
  const api = useApi();
  return useQuery({
    queryKey: [...queryKeys.allPayments, 'pending_review'],
    queryFn: async () =>
      (await api.get<{ payments: Payment[] }>('/box/payments', { status: 'pending_review' }))
        .payments,
  });
}

export function useOpenCharges(memberId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.openCharges(memberId ?? ''),
    queryFn: async () =>
      (
        await api.get<{ charges: Charge[] }>('/box/charges', {
          memberId: memberId ?? undefined,
          status: 'open',
        })
      ).charges,
    enabled: memberId !== null,
  });
}

export { useMovements, usePlans, usePrograms } from '@guaranix/ui/data';
