import type { Location } from '@guaranix/shared/api';
import type { CreateLocationInput, UpdateLocationInput } from '@guaranix/shared/schemas';
import { catalogKeys, useApi } from '@guaranix/ui/data';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';

/** Creates a location, or updates one when `locationId` is set. */
export function useSaveLocation(locationId: string | null) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateLocationInput | UpdateLocationInput) =>
      locationId
        ? (await api.patch<{ location: Location }>(`/box/locations/${locationId}`, input)).location
        : (await api.post<{ location: Location }>('/box/locations', input)).location,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: catalogKeys.locations });
      // Class lists carry the location's name.
      await queryClient.invalidateQueries({ queryKey: queryKeys.allClasses });
    },
  });
}
