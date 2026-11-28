import { dateOfInstant, formatGuarani, formatShortDate, t } from '@guaranix/shared';
import type { Payment } from '@guaranix/shared/api';
import { Avatar, Card, Skeleton, PaymentMethodBadge } from '@guaranix/ui';
import { useBoxClock } from '@guaranix/ui/data';

export interface RecentPaymentsCardProps {
  payments: readonly Payment[] | undefined;
}

export function RecentPaymentsCard({ payments }: RecentPaymentsCardProps) {
  const { timeZone } = useBoxClock();
  const confirmed = (payments ?? []).filter((payment) => payment.status === 'confirmed');
  return (
    <Card>
      <h2 className="font-display text-lg font-bold">{t('admin.payments.recentTitle')}</h2>
      {payments === undefined ? (
        <Skeleton className="h-40" />
      ) : confirmed.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('admin.payments.noPayments')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-divider">
          {confirmed.map((payment) => (
            <li key={payment.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <Avatar firstName={payment.firstName} lastName={payment.lastName} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="line-clamp-2 font-medium">
                  {payment.firstName} {payment.lastName}
                </span>
                <span className="text-xs text-text-secondary">
                  {formatShortDate(dateOfInstant(timeZone, payment.paidAt))}
                </span>
              </span>
              <span className="hidden sm:block">
                <PaymentMethodBadge method={payment.method} />
              </span>
              <span className="shrink-0 text-right font-semibold tabular-nums sm:w-28">
                {formatGuarani(payment.amountGs)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
