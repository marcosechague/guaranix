import type { AiImportProposal, AiImportRequest, AiImportStatus } from '@guaranix/shared';
import { useApi } from '@guaranix/ui/data';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const statusKey = ['imports', 'ai-status'] as const;

export function useAiImportStatus() {
  const api = useApi();
  return useQuery({
    queryKey: statusKey,
    queryFn: async () =>
      (await api.get<{ status: AiImportStatus }>('/box/imports/ai-status')).status,
  });
}

/** Reads the file with AI. Saves nothing but the use, which counts even if the read fails. */
export function useExtractWithAi() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: AiImportRequest) =>
      api.post<AiImportProposal>('/box/ai-imports/extract', request),
    onSettled: () => queryClient.invalidateQueries({ queryKey: statusKey }),
  });
}
