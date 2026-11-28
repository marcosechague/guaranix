import type { BrodiAnswer, BrodiOverview } from '@guaranix/shared';
import { useApi } from '@guaranix/ui/data';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const overviewKey = ['brodi'] as const;

/** The person's own conversation, the box's last weekly summary and the monthly quota. */
export function useBrodiOverview(enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: overviewKey,
    queryFn: () => api.get<BrodiOverview>('/box/brodi'),
    enabled,
  });
}

/** Asks a question. The use counts even if the answer fails, so the quota is refreshed either way. */
export function useAskBrodi() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (question: string) => api.post<BrodiAnswer>('/box/brodi-questions', { question }),
    onSuccess: (answer) =>
      queryClient.setQueryData<BrodiOverview>(overviewKey, (current) =>
        current
          ? {
              ...current,
              usage: answer.usage,
              messages: [...current.messages, answer.question, answer.answer],
            }
          : current,
      ),
    onError: () => queryClient.invalidateQueries({ queryKey: overviewKey }),
  });
}
