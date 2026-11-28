import { formatGuarani, formatShortDate, t } from '@guaranix/shared';
import type { OwnAccount } from '@guaranix/shared/api';
import { Badge, type BadgeTone, Card, CardList, CardListItem } from '@guaranix/ui';
import { type FeeState, feeState } from '../../lib/fees';

const TONES: Record<FeeState['kind'], BadgeTone> = {
  paid: 'success',
  in_review: 'neutral',
  overdue: 'warning',
  due: 'outline',
};

const stateLabel = (state: FeeState) =>
  state.kind === 'due'
    ? t('member.fees.states.due', { date: formatShortDate(state.dueOn) })
    : t(`member.fees.states.${state.kind}`);

/** Every fee, newest first, with what is left on each. */
export function ChargesCard({ account, today }: { account: OwnAccount; today: string }) {
  const charges = account.charges
    .filter((charge) => charge.status !== 'void')
    .sort((a, b) => b.dueOn.localeCompare(a.dueOn));
  return (
    <Card>
      <h2 className="font-display text-lg font-bold">{t('member.fees.chargesTitle')}</h2>
      {charges.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('member.fees.noCharges')}</p>
      ) : (
        <CardList>
          {charges.map((charge) => {
            const state = feeState(charge, account, today);
            return (
              <CardListItem key={charge.id}>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-semibold">{charge.description}</span>
                  <span>
                    <Badge tone={TONES[state.kind]} dot={state.kind !== 'due'}>
                      {stateLabel(state)}
                    </Badge>
                  </span>
                </span>
                <span className="font-semibold tabular-nums">
                  {formatGuarani(state.kind === 'paid' ? charge.amountGs : charge.outstandingGs)}
                </span>
              </CardListItem>
            );
          })}
        </CardList>
      )}
    </Card>
  );
}
