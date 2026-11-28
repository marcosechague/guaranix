import type { ConnectPaymentAccountInput } from '@guaranix/shared';
import type { PaymentAccountView, PaymentSettingsResponse } from '@guaranix/shared/api';
import { useApi } from '@guaranix/ui/data';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const settingsKey = ['settings', 'card-payments'] as const;

export function usePaymentSettings(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: settingsKey,
    queryFn: () => api.get<PaymentSettingsResponse>('/box/card-payments/settings'),
    enabled,
  });
}

/** Every change answers with the account as it now is; the cache takes it as is. */
function useAccountMutation<Input>(
  send: (api: ReturnType<typeof useApi>, input: Input) => Promise<{ account: PaymentAccountView }>,
) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Input) => (await send(api, input)).account,
    onSuccess: (account) =>
      queryClient.setQueryData<PaymentSettingsResponse>(settingsKey, (current) =>
        current ? { ...current, account } : current,
      ),
  });
}

export const useConnectPaymentAccount = () =>
  useAccountMutation((api, input: ConnectPaymentAccountInput) =>
    api.put('/box/card-payments/account', input),
  );

export const useToggleAutopay = () =>
  useAccountMutation((api, autopayEnabled: boolean) =>
    api.patch('/box/card-payments/account', { autopayEnabled }),
  );

export const useDisconnectPaymentAccount = () =>
  useAccountMutation((api) => api.delete('/box/card-payments/account'));
