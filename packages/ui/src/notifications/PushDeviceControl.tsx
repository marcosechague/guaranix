import { t } from '@guaranix/shared';
import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { FormMessage } from '../components/FormMessage';
import { errorText } from '../data/ApiProvider';
import { currentPushSubscription, pushSupport, subscribeToPush } from './browser-push';
import { useRemovePushSubscription, useSavePushSubscription } from './use-notification-settings';

/** Turns push on or off for this browser only; the topic switches apply to every device. */
export function PushDeviceControl({ publicKey }: { publicKey: string }) {
  const [support, setSupport] = useState(pushSupport);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = useSavePushSubscription();
  const remove = useRemovePushSubscription();
  const busy = save.isPending || remove.isPending;

  useEffect(() => {
    void currentPushSubscription().then((subscription) =>
      setEndpoint(subscription?.endpoint ?? null),
    );
  }, []);

  async function enable() {
    setError(null);
    try {
      const subscription = await subscribeToPush(publicKey);
      if (!subscription) {
        setSupport(pushSupport());
        return;
      }
      await save.mutateAsync(subscription);
      setEndpoint(subscription.endpoint);
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  async function disable() {
    setError(null);
    try {
      const subscription = await currentPushSubscription();
      await subscription?.unsubscribe();
      if (endpoint) await remove.mutateAsync(endpoint);
      setEndpoint(null);
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  if (support === 'unsupported') {
    return (
      <p className="text-sm text-text-secondary">{t('notifications.settings.push.unsupported')}</p>
    );
  }
  if (support === 'denied') {
    return <FormMessage tone="error">{t('notifications.settings.push.denied')}</FormMessage>;
  }
  return (
    <div className="flex flex-col gap-2">
      {endpoint ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-semibold text-success">
            {t('notifications.settings.push.enabled')}
          </span>
          <Button variant="secondary" onClick={() => void disable()} disabled={busy}>
            {t('notifications.settings.push.disable')}
          </Button>
        </div>
      ) : (
        <Button onClick={() => void enable()} disabled={busy} className="w-full">
          {t('notifications.settings.push.enable')}
        </Button>
      )}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  );
}
