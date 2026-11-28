import type {
  NotificationPreferenceInput,
  NotificationSettings,
  PushSubscriptionInput,
  TelegramLinkStart,
} from '@guaranix/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../data/ApiProvider';

export const notificationSettingsKey = ['notifications', 'settings'] as const;

/**
 * `pollUntil` (an ISO instant) keeps refreshing while waiting for the person to
 * tap Start in Telegram, until the chat shows up as linked or the link expires.
 */
export function useNotificationSettings(options: { pollUntil?: string | null } = {}) {
  const api = useApi();
  const { pollUntil } = options;
  return useQuery({
    queryKey: notificationSettingsKey,
    queryFn: () => api.get<NotificationSettings>('/notifications/settings'),
    refetchInterval: (query) =>
      pollUntil && !query.state.data?.telegram.linked && Date.now() < Date.parse(pollUntil)
        ? 3000
        : false,
  });
}

function useSettingsMutation<Input, Output>(send: (input: Input) => Promise<Output>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationSettingsKey }),
  });
}

export function useSetNotificationPreference() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NotificationPreferenceInput) =>
      api.put('/notifications/preferences', input),
    // The switch moves at once; a failure puts it back.
    onMutate: (input) => {
      const previous = queryClient.getQueryData<NotificationSettings>(notificationSettingsKey);
      if (previous) {
        queryClient.setQueryData<NotificationSettings>(notificationSettingsKey, {
          ...previous,
          preferences: previous.preferences.map((preference) =>
            preference.topic === input.topic && preference.channel === input.channel
              ? { ...preference, enabled: input.enabled }
              : preference,
          ),
        });
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(notificationSettingsKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationSettingsKey }),
  });
}

export function useSavePushSubscription() {
  const api = useApi();
  return useSettingsMutation((input: PushSubscriptionInput) =>
    api.post('/notifications/push-subscriptions', input),
  );
}

export function useRemovePushSubscription() {
  const api = useApi();
  return useSettingsMutation((endpoint: string) =>
    api.post('/notifications/push-subscriptions/remove', { endpoint }),
  );
}

export function useStartTelegramLink() {
  const api = useApi();
  return useSettingsMutation(() => api.post<TelegramLinkStart>('/notifications/telegram/link'));
}

export function useUnlinkTelegram() {
  const api = useApi();
  return useSettingsMutation(() => api.delete('/notifications/telegram/link'));
}
