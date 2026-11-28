import type { WallQrView } from '@guaranix/shared/schemas';
import { useApi } from '@guaranix/ui/data';
import { useQuery } from '@tanstack/react-query';

export function useWallPoster(locationId: string) {
  const api = useApi();
  return useQuery({
    queryKey: ['wall-poster', locationId],
    queryFn: async () =>
      (await api.get<{ poster: WallQrView }>(`/box/locations/${locationId}/wall-qr`)).poster,
    staleTime: Infinity,
  });
}
