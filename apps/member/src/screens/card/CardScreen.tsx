import { t } from '@guaranix/shared';
import type { StartCardResponse } from '@guaranix/shared/api';
import {
  Button,
  Card,
  EmptyState,
  FormMessage,
  Page,
  PageHeader,
  Skeleton,
  SwitchField,
  useToast,
} from '@guaranix/ui';
import { errorText, LoadError } from '@guaranix/ui/data';
import { CreditCard } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useConfirmCard, useOwnCards, useRemoveCard, useStartCard } from '../../api/cards';
import { HostedCheckout } from '../../payments/HostedCheckout';
import { SavedCardSummary } from './SavedCardSummary';

/** Back from the processor's form (`?card=<id>`): confirm once, then clean the URL. */
function useReturnFromForm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const confirm = useConfirmCard();
  const toast = useToast();
  const cardId = params.get('card');
  const started = useRef(false);
  useEffect(() => {
    if (!cardId || started.current) return;
    started.current = true;
    confirm.mutate(cardId, {
      onSuccess: () => toast.show(t('member.cards.saved')),
      onSettled: () => void navigate('/cuota/tarjeta', { replace: true }),
    });
  }, [cardId, confirm, navigate, toast]);
  return confirm;
}

export function CardScreen() {
  const cards = useOwnCards();
  const start = useStartCard();
  const remove = useRemoveCard();
  const confirm = useReturnFromForm();
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);
  const [checkout, setCheckout] = useState<StartCardResponse | null>(null);
  const error = start.error ?? confirm.error ?? remove.error;

  const header = (
    <PageHeader title={t('member.cards.title')} subtitle={t('member.cards.subtitle')} />
  );
  if (cards.isPending || confirm.isPending) {
    return (
      <Page layout="mobile">
        {header}
        <Skeleton className="h-48 rounded-xl" />
      </Page>
    );
  }
  if (cards.isError) {
    return (
      <Page layout="mobile">
        {header}
        <LoadError error={cards.error} onRetry={() => void cards.refetch()} />
      </Page>
    );
  }
  const current = cards.data.cards[0];
  return (
    <Page layout="mobile">
      {header}
      {!cards.data.available ? (
        <Card>
          <EmptyState
            icon={CreditCard}
            title={t('member.cards.unavailableTitle')}
            description={t('member.cards.unavailableBody')}
          />
        </Card>
      ) : checkout ? (
        <Card className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">{t('member.cards.formHint')}</p>
          <HostedCheckout
            checkout={checkout.checkout}
            onSimulate={(approved) =>
              approved
                ? void navigate(`/cuota/tarjeta?card=${checkout.card.id}`)
                : setCheckout(null)
            }
          />
          <Button type="button" variant="ghost" onClick={() => setCheckout(null)}>
            {t('common.cancel')}
          </Button>
        </Card>
      ) : (
        <>
          {current ? (
            <SavedCardSummary
              card={current}
              autopayEnabled={cards.data.autopayEnabled}
              removing={remove.isPending}
              onRemove={() => remove.mutate(current.id)}
            />
          ) : null}
          <Card className="flex flex-col gap-4">
            <h2 className="font-display text-lg font-bold">
              {current ? t('member.cards.replaceTitle') : t('member.cards.addTitle')}
            </h2>
            <SwitchField
              label={t('member.cards.consentLabel')}
              description={t('member.cards.consent')}
              checked={accepted}
              onChange={setAccepted}
            />
            <Button
              type="button"
              disabled={!accepted || start.isPending}
              onClick={() => start.mutate(undefined, { onSuccess: setCheckout })}
            >
              {start.isPending ? t('common.loading') : t('member.cards.add')}
            </Button>
            <p className="text-xs text-text-secondary">{t('member.cards.safety')}</p>
          </Card>
        </>
      )}
      {error ? <FormMessage tone="error">{errorText(error)}</FormMessage> : null}
    </Page>
  );
}
