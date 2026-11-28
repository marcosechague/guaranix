import { formatGuarani, formatShortDate, t } from '@guaranix/shared';
import { Avatar, Button, Card, Skeleton, useToast } from '@guaranix/ui';
import { errorText, LoadError, useBoxClock } from '@guaranix/ui/data';
import { dateOfInstant } from '@guaranix/shared';
import { useReviewPayment } from '../../api/mutations';
import { usePaymentsToReview } from '../../api/queries';
import { PaymentMethodBadge } from './PaymentMethodBadge';

export function ReviewQueueCard() {
  const { timeZone } = useBoxClock();
  const queue = usePaymentsToReview();
  const review = useReviewPayment();
  const toast = useToast();

  const decide = (paymentId: string, status: 'confirmed' | 'rejected') =>
    review.mutate(
      { paymentId, status },
      {
        onSuccess: () =>
          toast.show(
            t(status === 'confirmed' ? 'admin.payments.confirmed' : 'admin.payments.rejected'),
          ),
        onError: (error) => toast.show(errorText(error), 'error'),
      },
    );

  return (
    <Card>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold">{t('admin.payments.toReviewTitle')}</h2>
        <p className="text-sm text-text-secondary">{t('admin.payments.toReviewHint')}</p>
      </div>
      {queue.isPending ? (
        <Skeleton className="h-20" />
      ) : queue.isError ? (
        <LoadError error={queue.error} onRetry={() => void queue.refetch()} />
      ) : queue.data.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('admin.payments.noneToReview')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-divider">
          {queue.data.map((payment) => {
            const name = `${payment.firstName} ${payment.lastName}`;
            return (
              <li
                key={payment.id}
                className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar firstName={payment.firstName} lastName={payment.lastName} size="sm" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">{name}</span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                      <PaymentMethodBadge method={payment.method} />
                      {payment.reference
                        ? t('admin.payments.referenceShort', { reference: payment.reference })
                        : null}
                      <span>{formatShortDate(dateOfInstant(timeZone, payment.paidAt))}</span>
                    </span>
                  </span>
                </span>
                <span className="font-display text-lg font-bold tabular-nums">
                  {formatGuarani(payment.amountGs)}
                </span>
                <span className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1 px-3 text-sm"
                    aria-label={t('admin.payments.rejectLabel', { name })}
                    disabled={review.isPending}
                    onClick={() => decide(payment.id, 'rejected')}
                  >
                    {t('admin.payments.reject')}
                  </Button>
                  <Button
                    className="flex-1 px-3 text-sm"
                    aria-label={t('admin.payments.confirmLabel', { name })}
                    disabled={review.isPending}
                    onClick={() => decide(payment.id, 'confirmed')}
                  >
                    {t('admin.payments.confirm')}
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
