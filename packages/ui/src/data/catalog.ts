import type { Location, Movement, Plan, Program } from '@guaranix/shared/api';
import { useQuery } from '@tanstack/react-query';
import { useApi } from './ApiProvider';

/** Box catalog that every app reads and rarely changes: plans, programs, movements, locations. */
export const catalogKeys = {
  plans: ['plans'] as const,
  programs: ['programs'] as const,
  movements: ['movements'] as const,
  locations: ['locations'] as const,
};

/** The box's locations, default first. Members get only the open ones. */
export function useLocations() {
  const api = useApi();
  return useQuery({
    queryKey: catalogKeys.locations,
    queryFn: async () => (await api.get<{ locations: Location[] }>('/box/locations')).locations,
    staleTime: 10 * 60_000,
  });
}

export function usePlans() {
  const api = useApi();
  return useQuery({
    queryKey: catalogKeys.plans,
    queryFn: async () => (await api.get<{ plans: Plan[] }>('/box/plans')).plans,
    staleTime: 10 * 60_000,
  });
}

export function usePrograms() {
  const api = useApi();
  return useQuery({
    queryKey: catalogKeys.programs,
    queryFn: async () => (await api.get<{ programs: Program[] }>('/box/programs')).programs,
    staleTime: 10 * 60_000,
  });
}

export function useMovements() {
  const api = useApi();
  return useQuery({
    queryKey: catalogKeys.movements,
    queryFn: async () => (await api.get<{ movements: Movement[] }>('/box/movements')).movements,
    staleTime: 30 * 60_000,
  });
}
