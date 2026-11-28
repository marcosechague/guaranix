import { dateOfInstant, formatGuarani, formatShortDate, t } from '@guaranix/shared';
import type { OwnAccount } from '@guaranix/shared/api';
import type { PaymentStatus } from '@guaranix/shared/domain';
import {
  Badge,
  type BadgeTone,
  Card,
  PaymentMethodBadge,
  CardList,
  CardListItem,
} from '@guaranix/ui';

const TONES: Record<PaymentStatus, BadgeTone> = {
  confirmed: 'success',
  pending_review: 'neutral',
  rejected: 'warning',
};

/** What the member paid or reported, newest first, and whether the front desk confirmed it. */
export function PaymentHistoryCard({
  account,
  timeZone,
}: {
  account: OwnAccount;
  timeZone: string;
}) {
  const payments = [...account.payments].sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  return (
    <Card>
      <h2 className="font-display text-lg font-bold">{t('member.fees.paymentsTitle')}</h2>
      {payments.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('member.fees.noPayments')}</p>
      ) : (
        <CardList>
          {payments.map((payment) => (
            <CardListItem key={payment.id}>
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="font-semibold tabular-nums">
                  {formatShortDate(dateOfInstant(timeZone, payment.paidAt))}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <PaymentMethodBadge method={payment.method} />
                  <Badge tone={TONES[payment.status]} dot>
                    {t(`payments.statuses.${payment.status}`)}
                  </Badge>
                </span>
              </span>
              <span className="font-semibold tabular-nums">{formatGuarani(payment.amountGs)}</span>
            </CardListItem>
          ))}
        </CardList>
      )}
    </Card>
  );
}
