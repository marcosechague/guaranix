import type {
  AiConfiguration,
  AiSettingsInput,
  BoxFeatureInput,
  BoxFeatureState,
  PlanFeatureInput,
  PlanFeatureState,
} from '@guaranix/shared';
import type { AiProviderName, FeatureFlag } from '@guaranix/shared/domain';
import { useApi } from '@guaranix/ui/data';
import { useQuery } from '@tanstack/react-query';
import { usePlatformMutation } from './queries';

const keys = {
  ai: ['platform', 'ai'] as const,
  planFeatures: (planId: string) => ['platform', 'plan-features', planId] as const,
  boxFeatures: (boxId: string) => ['platform', 'box-features', boxId] as const,
};

export function useAiConfiguration() {
  const api = useApi();
  return useQuery({ queryKey: keys.ai, queryFn: () => api.get<AiConfiguration>('/platform/ai') });
}

export function useAiMutations() {
  const api = useApi();
  return {
    saveSettings: usePlatformMutation((input: AiSettingsInput) => api.patch('/platform/ai', input)),
    saveKey: usePlatformMutation(
      ({ provider, apiKey }: { provider: AiProviderName; apiKey: string }) =>
        api.put<{ key: { provider: AiProviderName; hint: string } }>(
          `/platform/ai/keys/${provider}`,
          {
            apiKey,
          },
        ),
    ),
    removeKey: usePlatformMutation((provider: AiProviderName) =>
      api.delete(`/platform/ai/keys/${provider}`),
    ),
    test: usePlatformMutation(() =>
      api.post<{ ok: boolean; provider: AiProviderName; model: string }>('/platform/ai/test'),
    ),
  };
}

export function usePlanFeatures(planId: string) {
  const api = useApi();
  return useQuery({
    queryKey: keys.planFeatures(planId),
    queryFn: async () =>
      (await api.get<{ features: PlanFeatureState[] }>(`/platform/plans/${planId}/features`))
        .features,
  });
}

export function useSavePlanFeature(planId: string) {
  const api = useApi();
  return usePlatformMutation(({ feature, ...input }: PlanFeatureInput & { feature: FeatureFlag }) =>
    api.put(`/platform/plans/${planId}/features/${feature}`, input),
  );
}

export function useBoxFeatures(boxId: string) {
  const api = useApi();
  return useQuery({
    queryKey: keys.boxFeatures(boxId),
    queryFn: async () =>
      (await api.get<{ features: BoxFeatureState[] }>(`/platform/boxes/${boxId}/features`))
        .features,
  });
}

export function useSaveBoxFeature(boxId: string) {
  const api = useApi();
  return usePlatformMutation(({ feature, ...input }: BoxFeatureInput & { feature: FeatureFlag }) =>
    api.put(`/platform/boxes/${boxId}/features/${feature}`, input),
  );
}
