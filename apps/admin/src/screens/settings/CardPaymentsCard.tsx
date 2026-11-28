import { t } from '@guaranix/shared';
import { Card, FormMessage, Skeleton } from '@guaranix/ui';
import { LoadError } from '@guaranix/ui/data';
import { usePaymentSettings } from '../../api/card-payments';
import { ConnectAccountForm } from './ConnectAccountForm';
import { PaymentAccountSummary } from './PaymentAccountSummary';

/**
 * Card payments with the box's own processor account (Bancard): the money goes
 * straight to the box. Managers see it; only the owner connects or changes keys.
 */
export function CardPaymentsCard({ isOwner }: { isOwner: boolean }) {
  const settings = usePaymentSettings(true);
  if (settings.isPending) return <Skeleton className="h-56 rounded-xl" />;
  if (settings.isError) {
    return <LoadError error={settings.error} onRetry={() => void settings.refetch()} />;
  }
  const { included, secretsReady, providers, account } = settings.data;
  const connected = account?.connected ? account : null;
  return (
    <Card as="section">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold">{t('admin.settings.cards.title')}</h2>
        <p className="text-sm text-text-secondary">{t('admin.settings.cards.hint')}</p>
      </div>
      {!included ? (
        <p className="text-sm text-text-secondary">{t('admin.settings.cards.notIncluded')}</p>
      ) : !secretsReady ? (
        <FormMessage tone="error">{t('errors.payments_secrets_key_missing')}</FormMessage>
      ) : connected ? (
        <PaymentAccountSummary account={connected} isOwner={isOwner} providers={providers} />
      ) : isOwner ? (
        <ConnectAccountForm providers={providers} />
      ) : (
        <p className="text-sm text-text-secondary">{t('admin.settings.cards.ownerConnects')}</p>
      )}
    </Card>
  );
}
