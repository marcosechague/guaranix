import type { ClassSchedule, Member, MemberPlan, Plan, Workout } from '@guaranix/shared/api';
import type {
  BookingPolicy,
  CreateMemberInput,
  CreatePlanInput,
  CreateWorkoutInput,
  RecordPaymentInput,
  UpdateMemberInput,
} from '@guaranix/shared/schemas';
import { recordPaymentWithReceipt, useApi } from '@guaranix/ui/data';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';

export function useCreateMember() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMemberInput) =>
      (await api.post<{ member: Member }>('/box/members', input)).member,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.allMembers }),
  });
}

export function useUpdateMember(memberId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateMemberInput) =>
      (await api.patch<{ member: Member }>(`/box/members/${memberId}`, input)).member,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.allMembers }),
  });
}

export function useAssignPlan(memberId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { planId: string; startsOn: string }) =>
      (await api.post<{ memberPlan: MemberPlan }>(`/box/members/${memberId}/plans`, input))
        .memberPlan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.memberPlans(memberId) }),
  });
}

export function useSavePlan(planId: string | null) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePlanInput) =>
      planId
        ? (await api.patch<{ plan: Plan }>(`/box/plans/${planId}`, input)).plan
        : (await api.post<{ plan: Plan }>('/box/plans', input)).plan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.plans }),
  });
}

export function useMarkAttendance(classId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entries: { bookingId: string; status: 'attended' | 'no_show' }[]) =>
      api.post(`/box/classes/${classId}/attendance`, { entries }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.roster(classId) }),
  });
}

export function useCancelClass(classId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string | null) => api.post(`/box/classes/${classId}/cancel`, { reason }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.allClasses }),
        queryClient.invalidateQueries({ queryKey: queryKeys.roster(classId) }),
      ]),
  });
}

export function useSaveWorkout(workoutId: string | null) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateWorkoutInput) =>
      workoutId
        ? (await api.patch<{ workout: Workout }>(`/box/workouts/${workoutId}`, input)).workout
        : (await api.post<{ workout: Workout }>('/box/workouts', input)).workout,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.allWorkouts }),
  });
}

export function useSetWorkoutPublished() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ workoutId, published }: { workoutId: string; published: boolean }) =>
      (
        await api.post<{ workout: Workout }>(
          `/box/workouts/${workoutId}/${published ? 'publish' : 'unpublish'}`,
        )
      ).workout,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.allWorkouts }),
  });
}

export function useSaveBookingPolicy() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (policy: BookingPolicy) =>
      (await api.patch<{ policy: BookingPolicy }>('/box/settings/booking', policy)).policy,
    onSuccess: (policy) => queryClient.setQueryData(queryKeys.bookingPolicy, policy),
  });
}

export function useUpdateScheduleCapacity(scheduleId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (capacity: number) =>
      api.patch<{ schedule: ClassSchedule; updatedClasses: number }>(
        `/box/schedules/${scheduleId}`,
        { capacity },
      ),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.schedules }),
        queryClient.invalidateQueries({ queryKey: queryKeys.allClasses }),
      ]),
  });
}

/** Money moved: refresh payments, balances, debtors and the dashboard together. */
function invalidateMoney(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all(
    [queryKeys.allPayments, queryKeys.allCharges, queryKeys.debtors, ['dashboard']].map(
      (queryKey) => queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

export function useRecordPayment() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, receipt }: { input: RecordPaymentInput; receipt: File | null }) =>
      recordPaymentWithReceipt(api, input, receipt),
    onSuccess: () => invalidateMoney(queryClient),
  });
}

export function useReviewPayment() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, status }: { paymentId: string; status: 'confirmed' | 'rejected' }) =>
      api.post(`/box/payments/${paymentId}/review`, { status }),
    onSuccess: () => invalidateMoney(queryClient),
  });
}
