import type { DataImportRecord, DataImportRequest, ImportAnalysis } from '@guaranix/shared';
import { useApi } from '@guaranix/ui/data';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';

const importsKey = ['imports'] as const;

export function useImports() {
  const api = useApi();
  return useQuery({
    queryKey: importsKey,
    queryFn: async () => (await api.get<{ imports: DataImportRecord[] }>('/box/imports')).imports,
  });
}

/** A POST that writes nothing: the rows travel in the body. */
export function usePreviewImport() {
  const api = useApi();
  return useMutation({
    mutationFn: async (request: DataImportRequest) =>
      (await api.post<{ analysis: ImportAnalysis }>('/box/imports/preview', request)).analysis,
  });
}

export interface CommitImportResult {
  import: DataImportRecord;
  analysis: ImportAnalysis | null;
  replayed: boolean;
}

export function useCommitImport() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: DataImportRequest) =>
      api.post<CommitImportResult>('/box/imports', request),
    // An import touches members, plans, debts and the dashboard at once.
    onSuccess: () =>
      Promise.all(
        [importsKey, queryKeys.allMembers, queryKeys.plans, queryKeys.debtors, ['dashboard']].map(
          (queryKey) => queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  });
}
