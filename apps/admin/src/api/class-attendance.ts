import type { CheckInResult } from '@guaranix/shared/schemas';
import { useApi } from '@guaranix/ui/data';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';

/** The coach adds someone who came without booking; a "no" comes back as a result, not an error. */
export function useAddWalkIn(classId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) =>
      (
        await api.post<{ result: CheckInResult }>(`/box/classes/${classId}/walk-ins`, {
          memberId,
        })
      ).result,
    onSuccess: async (result) => {
      if (result.outcome === 'denied') return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.roster(classId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.allClasses }),
      ]);
    },
  });
}
