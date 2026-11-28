import type { Booking, Leaderboard, ScoreValues, WorkoutResult } from '@guaranix/shared/api';
import type { Scaling } from '@guaranix/shared/domain';
import type { RecordPaymentInput } from '@guaranix/shared/schemas';
import { recordPaymentWithReceipt, useApi } from '@guaranix/ui/data';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';

export function useBookClass() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (classId: string) =>
      (await api.post<{ booking: Booking }>('/box/bookings', { classId })).booking,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.allClasses }),
        queryClient.invalidateQueries({ queryKey: queryKeys.myBookings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.myPlans }),
      ]),
  });
}

export function useCancelBooking() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => api.post(`/box/bookings/${bookingId}/cancel`, {}),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.allClasses }),
        queryClient.invalidateQueries({ queryKey: queryKeys.myBookings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.myPlans }),
      ]),
  });
}

export interface ResultDraft extends ScoreValues {
  componentId: string;
  scaling: Scaling;
  notes: string | null;
}

export function useLogResult() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: ResultDraft) =>
      api.post<{ result: WorkoutResult; isPersonalRecord: boolean }>('/box/results', draft),
    onSuccess: (_data, draft) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard(draft.componentId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.myRecords }),
      ]),
  });
}

/** Optimistic: the fist lights up on tap and rolls back if the request fails. */
export function useFistBump(componentId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  const key = queryKeys.leaderboard(componentId);
  return useMutation({
    mutationFn: (resultId: string) =>
      api.post<{ bumped: boolean }>(`/box/results/${resultId}/fist-bump`, {}),
    onMutate: async (resultId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Leaderboard>(key);
      if (previous) {
        queryClient.setQueryData<Leaderboard>(key, {
          ...previous,
          entries: previous.entries.map((entry) =>
            entry.id === resultId
              ? {
                  ...entry,
                  bumpedByMe: !entry.bumpedByMe,
                  fistBumps: entry.fistBumps + (entry.bumpedByMe ? -1 : 1),
                }
              : entry,
          ),
        });
      }
      return { previous };
    },
    onError: (_error, _resultId, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

/** A member reports a transfer or QR with its receipt; it waits for the front desk to confirm it. */
export function useReportPayment() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, receipt }: { input: RecordPaymentInput; receipt: File }) =>
      recordPaymentWithReceipt(api, input, receipt),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.myAccount }),
  });
}
