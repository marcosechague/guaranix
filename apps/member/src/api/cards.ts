import type { OwnCardsResponse, SavedCardView, StartCardResponse } from '@guaranix/shared/api';
import { useApi } from '@guaranix/ui/data';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const cardsKey = ['me', 'cards'] as const;

export function useOwnCards() {
  const api = useApi();
  return useQuery({
    queryKey: cardsKey,
    queryFn: () => api.get<OwnCardsResponse>('/box/card-payments/me/cards'),
  });
}

/** The member accepted automatic charges; the processor's form comes back. */
export function useStartCard() {
  const api = useApi();
  return useMutation({
    mutationFn: () =>
      api.post<StartCardResponse>('/box/card-payments/me/cards', { acceptAutopay: true }),
  });
}

function useCardChange<Input>(
  send: (api: ReturnType<typeof useApi>, input: Input) => Promise<unknown>,
) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Input) => send(api, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cardsKey }),
  });
}

/** Back from the processor's form: the API checks with the processor that the card was saved. */
export const useConfirmCard = () =>
  useCardChange((api, cardId: string) =>
    api.post<{ card: SavedCardView }>(`/box/card-payments/me/cards/${cardId}/confirm`, {}),
  );

export const useRemoveCard = () =>
  useCardChange((api, cardId: string) => api.delete(`/box/card-payments/me/cards/${cardId}`));
