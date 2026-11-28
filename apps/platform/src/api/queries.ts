import type {
  CreatePlatformBoxInput,
  PlatformBoxDetail,
  PlatformBoxFilter,
  PlatformBoxSummary,
  PlatformMetrics,
  PlatformPlan,
  PlatformPlanInput,
  UpdatePlatformBoxInput,
  UpdatePlatformPlanInput,
} from '@guaranix/shared';
import { useApi } from '@guaranix/ui/data';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const keys = {
  all: ['platform'] as const,
  metrics: ['platform', 'metrics'] as const,
  boxes: (status: PlatformBoxFilter, search: string) => ['platform', 'boxes', status, search],
  box: (boxId: string) => ['platform', 'box', boxId] as const,
  plans: ['platform', 'plans'] as const,
};

export function useMetrics() {
  const api = useApi();
  return useQuery({
    queryKey: keys.metrics,
    queryFn: async () => (await api.get<{ metrics: PlatformMetrics }>('/platform/metrics')).metrics,
  });
}

export function useBoxes(status: PlatformBoxFilter, search: string) {
  const api = useApi();
  return useQuery({
    queryKey: keys.boxes(status, search),
    queryFn: async () =>
      (await api.get<{ boxes: PlatformBoxSummary[] }>('/platform/boxes', { status, search })).boxes,
    placeholderData: keepPreviousData,
  });
}

export function useBox(boxId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: keys.box(boxId ?? ''),
    queryFn: () => api.get<PlatformBoxDetail>(`/platform/boxes/${boxId}`),
    enabled: boxId !== null,
  });
}

export function usePlans() {
  const api = useApi();
  return useQuery({
    queryKey: keys.plans,
    queryFn: async () => (await api.get<{ plans: PlatformPlan[] }>('/platform/plans')).plans,
  });
}

/** Every platform write can move metrics, lists and plan usage: refresh them all. */
function usePlatformMutation<Input, Result>(send: (input: Input) => Promise<Result>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  });
}

export type BoxAction = 'suspend' | 'reactivate' | 'remove';

export function useBoxMutations(boxId: string) {
  const api = useApi();
  return {
    update: usePlatformMutation((input: UpdatePlatformBoxInput) =>
      api.patch<PlatformBoxDetail>(`/platform/boxes/${boxId}`, input),
    ),
    changeStatus: usePlatformMutation(
      ({ action, reason }: { action: BoxAction; reason?: string }) =>
        api.post<PlatformBoxDetail>(`/platform/boxes/${boxId}/${action}`, reason ? { reason } : {}),
    ),
    impersonate: usePlatformMutation((reason: string) =>
      api.post<{ ok: true }>(`/platform/boxes/${boxId}/impersonate`, { reason }),
    ),
  };
}

export function useCreateBox() {
  const api = useApi();
  return usePlatformMutation((input: CreatePlatformBoxInput) =>
    api.post<PlatformBoxDetail>('/platform/boxes', input),
  );
}

export function useSavePlan(planId: string | null) {
  const api = useApi();
  return usePlatformMutation((input: PlatformPlanInput | UpdatePlatformPlanInput) =>
    planId
      ? api.patch<{ plan: PlatformPlan }>(`/platform/plans/${planId}`, input)
      : api.post<{ plan: PlatformPlan }>('/platform/plans', input),
  );
}
