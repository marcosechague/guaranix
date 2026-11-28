import type { NotificationSettings, TelegramLinkStart } from '@guaranix/shared';
import { t } from '@guaranix/shared';
import { Button } from '../components/Button';
import { FormMessage } from '../components/FormMessage';
import { errorText } from '../data/ApiProvider';
import { useStartTelegramLink, useUnlinkTelegram } from './use-notification-settings';

export interface TelegramLinkControlProps {
  telegram: NotificationSettings['telegram'];
  /** The link being waited on; the card polls settings until the chat is linked. */
  link: TelegramLinkStart | null;
  onLinkStarted: (link: TelegramLinkStart) => void;
}

/** Connect: get a one-time `t.me` link, tap Start in Telegram, done. */
export function TelegramLinkControl({ telegram, link, onLinkStarted }: TelegramLinkControlProps) {
  const start = useStartTelegramLink();
  const unlink = useUnlinkTelegram();
  const error = start.error ?? unlink.error;

  if (telegram.linked) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-semibold text-success">
          {telegram.username
            ? t('notifications.settings.telegram.connected', { username: `@${telegram.username}` })
            : t('notifications.settings.telegram.connectedNoUsername')}
        </span>
        <Button variant="secondary" onClick={() => unlink.mutate()} disabled={unlink.isPending}>
          {t('notifications.settings.telegram.disconnect')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {link ? (
        <>
          <Button asChild className="w-full">
            <a href={link.url} target="_blank" rel="noreferrer">
              {t('notifications.settings.telegram.open')}
            </a>
          </Button>
          <p className="text-sm text-text-secondary">{t('notifications.settings.telegram.hint')}</p>
        </>
      ) : (
        <Button
          variant="secondary"
          className="w-full"
          disabled={start.isPending}
          onClick={() => start.mutate(undefined, { onSuccess: onLinkStarted })}
        >
          {t('notifications.settings.telegram.connect')}
        </Button>
      )}
      {error ? <FormMessage tone="error">{errorText(error)}</FormMessage> : null}
    </div>
  );
}
