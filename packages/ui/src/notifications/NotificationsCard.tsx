import {
  type NotificationChannel,
  type NotificationPreference,
  type NotificationSettings,
  type NotificationTopic,
  t,
  type TelegramLinkStart,
} from '@guaranix/shared';
import { type ReactNode, useState } from 'react';
import { Card, Eyebrow } from '../components/Card';
import { Skeleton } from '../components/Skeleton';
import { SwitchField } from '../components/SwitchField';
import { LoadError } from '../data/LoadError';
import { PushDeviceControl } from './PushDeviceControl';
import { TelegramLinkControl } from './TelegramLinkControl';
import { useNotificationSettings, useSetNotificationPreference } from './use-notification-settings';

export interface NotificationsCardProps {
  /** Which topics this app offers: members get bookings, WOD and billing; staff get theirs. */
  topics: readonly NotificationTopic[];
  /** Channels this app can set up, in display order: push needs the member app's service worker. */
  channels: readonly NotificationChannel[];
}

function Unavailable({ children }: { children: ReactNode }) {
  return <p className="text-sm text-text-secondary">{children}</p>;
}

/** How this device or account connects to the channel, above its switches. */
function ChannelSetup({
  channel,
  settings,
  telegramLink,
  onTelegramLink,
}: {
  channel: NotificationChannel;
  settings: NotificationSettings;
  telegramLink: TelegramLinkStart | null;
  onTelegramLink: (link: TelegramLinkStart) => void;
}) {
  if (channel === 'push') {
    return settings.push.publicKey ? (
      <PushDeviceControl publicKey={settings.push.publicKey} />
    ) : (
      <Unavailable>{t('notifications.settings.push.unavailable')}</Unavailable>
    );
  }
  if (channel === 'telegram') {
    return settings.telegram.available ? (
      <TelegramLinkControl
        telegram={settings.telegram}
        link={telegramLink}
        onLinkStarted={onTelegramLink}
      />
    ) : (
      <Unavailable>{t('notifications.settings.telegram.unavailable')}</Unavailable>
    );
  }
  return <Unavailable>{t('notifications.settings.whatsappHint')}</Unavailable>;
}

/** What a person is told about and where; shared by the member app and the box panel. */
export function NotificationsCard({ topics, channels }: NotificationsCardProps) {
  const [telegramLink, setTelegramLink] = useState<TelegramLinkStart | null>(null);
  const settings = useNotificationSettings({ pollUntil: telegramLink?.expiresAt ?? null });
  const setPreference = useSetNotificationPreference();

  if (settings.isPending) return <Skeleton className="h-64 rounded-xl" />;
  if (settings.isError) {
    return <LoadError error={settings.error} onRetry={() => void settings.refetch()} />;
  }
  const switchesFor = (channel: NotificationChannel): NotificationPreference[] =>
    settings.data.preferences.filter(
      (preference) => preference.channel === channel && topics.includes(preference.topic),
    );

  return (
    <Card aria-labelledby="notifications-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="notifications-title" className="font-display text-lg font-bold">
          {t('notifications.settings.title')}
        </h2>
        <p className="text-sm text-text-secondary">{t('notifications.settings.subtitle')}</p>
      </div>
      {channels.map((channel) => (
        <section
          key={channel}
          className="flex flex-col gap-2"
          aria-label={t(`notifications.settings.channels.${channel}`)}
        >
          <Eyebrow>{t(`notifications.settings.channels.${channel}`)}</Eyebrow>
          <ChannelSetup
            channel={channel}
            settings={settings.data}
            telegramLink={telegramLink}
            onTelegramLink={setTelegramLink}
          />
          {switchesFor(channel).map((preference) => (
            <SwitchField
              key={`${preference.topic}:${preference.channel}`}
              label={t(`notifications.settings.topics.${preference.topic}`)}
              checked={preference.enabled}
              onChange={(enabled) =>
                setPreference.mutate({ topic: preference.topic, channel, enabled })
              }
            />
          ))}
        </section>
      ))}
    </Card>
  );
}
