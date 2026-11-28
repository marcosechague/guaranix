import { t } from '@guaranix/shared';
import type { HostedCheckoutView } from '@guaranix/shared/api';
import { Button, Card, FormMessage } from '@guaranix/ui';
import { useEffect, useId, useState } from 'react';

interface BancardForms {
  createForm(containerId: string, processId: string, options?: Record<string, unknown>): void;
}

declare global {
  interface Window {
    Bancard?: { Cards: BancardForms; Checkout: BancardForms };
  }
}

/** Loads Bancard's checkout script once; it renders its iframe into a container. */
function loadScript(url: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${CSS.escape(url)}"]`);
  if (existing && window.Bancard) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = existing ?? document.createElement('script');
    script.src = url;
    script.async = true;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('checkout script')), { once: true });
    if (!existing) document.head.append(script);
  });
}

function BancardFrame({
  checkout,
}: {
  checkout: Extract<HostedCheckoutView, { kind: 'bancard' }>;
}) {
  const containerId = `bancard-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadScript(checkout.scriptUrl)
      .then(() => {
        if (cancelled || !window.Bancard) return;
        const forms = checkout.form === 'card' ? window.Bancard.Cards : window.Bancard.Checkout;
        forms.createForm(containerId, checkout.processId);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [checkout, containerId]);
  if (failed) return <FormMessage tone="error">{t('member.cards.formFailed')}</FormMessage>;
  // Bancard's iframe: the card number is typed there, on Bancard's own domain.
  return <div id={containerId} className="min-h-96 w-full overflow-hidden rounded-xl" />;
}

export interface HostedCheckoutProps {
  checkout: HostedCheckoutView;
  /** Development only: what the mock processor's form would do. */
  onSimulate: (approved: boolean) => void;
}

/** The processor's form. With the development processor, two buttons stand in for it. */
export function HostedCheckout({ checkout, onSimulate }: HostedCheckoutProps) {
  if (checkout.kind === 'bancard') return <BancardFrame checkout={checkout} />;
  return (
    <Card spacing="compact" className="border-dashed">
      <p className="text-sm text-text-secondary">{t('member.cards.mockHint')}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => onSimulate(true)}>
          {t('member.cards.mockApprove')}
        </Button>
        <Button type="button" variant="secondary" onClick={() => onSimulate(false)}>
          {t('member.cards.mockDecline')}
        </Button>
      </div>
    </Card>
  );
}
