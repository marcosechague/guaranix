import { t } from '@guaranix/shared';
import type { PaymentAccountView } from '@guaranix/shared/api';
import type { PaymentProviderName } from '@guaranix/shared/domain';
import { Badge, Button, FormMessage, SwitchField, useToast } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { Copy } from 'lucide-react';
import { useState } from 'react';
import { useDisconnectPaymentAccount, useToggleAutopay } from '../../api/card-payments';
import { ConnectAccountForm } from './ConnectAccountForm';

export interface PaymentAccountSummaryProps {
  account: PaymentAccountView;
  isOwner: boolean;
  providers: PaymentProviderName[];
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-text-secondary">{label}</dt>
      <dd className="break-all font-mono text-sm">{value}</dd>
    </div>
  );
}

export function PaymentAccountSummary({ account, isOwner, providers }: PaymentAccountSummaryProps) {
  const toggle = useToggleAutopay();
  const disconnect = useDisconnectPaymentAccount();
  const toast = useToast();
  const [replacing, setReplacing] = useState(false);
  // Disconnecting stops every automatic charge: it takes a second tap.
  const [confirming, setConfirming] = useState(false);
  const error = toggle.error ?? disconnect.error;

  if (replacing)
    return <ConnectAccountForm providers={providers} onDone={() => setReplacing(false)} />;

  const copyWebhook = () =>
    void navigator.clipboard
      .writeText(account.webhookUrl)
      .then(() => toast.show(t('admin.settings.cards.copied')));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">
          {t(`admin.settings.cards.providers.${account.provider}`)}
        </span>
        <Badge tone={account.environment === 'production' ? 'success' : 'warning'} dot>
          {t(`admin.settings.cards.environments.${account.environment}`)}
        </Badge>
      </div>
      <dl className="grid gap-3 md:grid-cols-2">
        <Detail label={t('admin.settings.cards.publicKey')} value={`…${account.publicKeyHint}`} />
        <Detail label={t('admin.settings.cards.privateKey')} value={`…${account.privateKeyHint}`} />
      </dl>
      <div className="flex flex-col gap-2 rounded-lg bg-surface-sunken p-3">
        <span className="text-sm font-medium">{t('admin.settings.cards.webhook')}</span>
        <p className="text-xs text-text-secondary">{t('admin.settings.cards.webhookHint')}</p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 break-all text-xs">{account.webhookUrl}</code>
          <Button
            type="button"
            variant="secondary"
            onClick={copyWebhook}
            aria-label={t('admin.settings.cards.copyWebhook')}
          >
            <Copy aria-hidden="true" size={16} />
          </Button>
        </div>
      </div>
      <SwitchField
        label={t('admin.settings.cards.autopay')}
        description={t('admin.settings.cards.autopayHint')}
        checked={account.autopayEnabled}
        disabled={toggle.isPending}
        onChange={(checked) => toggle.mutate(checked)}
      />
      {error ? <FormMessage tone="error">{errorText(error)}</FormMessage> : null}
      {isOwner ? (
        <div className="flex flex-wrap justify-end gap-2">
          {confirming ? (
            <Button
              type="button"
              variant="danger"
              disabled={disconnect.isPending}
              onClick={() => disconnect.mutate(undefined)}
            >
              {t('admin.settings.cards.disconnectConfirm')}
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
              {t('admin.settings.cards.disconnect')}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={() => setReplacing(true)}>
            {t('admin.settings.cards.replaceKeys')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
