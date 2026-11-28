import type { CheckInPolicy } from '@guaranix/shared/schemas';
import { currentBoxKey, useApi } from '@guaranix/ui/data';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';

export function useCheckInPolicy() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.checkInPolicy,
    queryFn: async () =>
      (await api.get<{ policy: CheckInPolicy }>('/box/settings/check-in')).policy,
  });
}

export function useSaveCheckInPolicy() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (policy: CheckInPolicy) =>
      (await api.patch<{ policy: CheckInPolicy }>('/box/settings/check-in', policy)).policy,
    onSuccess: async (policy) => {
      queryClient.setQueryData(queryKeys.checkInPolicy, policy);
      // The menu shows Entrada only while the desk mode is on.
      await queryClient.invalidateQueries({ queryKey: currentBoxKey });
    },
  });
}
