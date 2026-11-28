import { formatGuarani, formatShortDate, t } from '@guaranix/shared';
import { Avatar, Button, Card, Skeleton, CardList, CardListItem } from '@guaranix/ui';
import { LoadError, useBoxClock } from '@guaranix/ui/data';
import { MessageCircle } from 'lucide-react';
import { useDebtors } from '../../api/queries';
import { whatsappUrl } from '../../lib/whatsapp';

export interface DebtorsCardProps {
  /** On the payments screen each debtor gets a "Cobrar" button. */
  onCollect?: (memberId: string) => void;
  limit?: number;
}

export function DebtorsCard({ onCollect, limit = 5 }: DebtorsCardProps) {
  const { boxName } = useBoxClock();
  const debtors = useDebtors(true);
  return (
    <Card>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold">{t('admin.home.debtors')}</h2>
        <p className="text-sm text-text-secondary">{t('admin.home.debtorsHint')}</p>
      </div>
      {debtors.isPending ? (
        <Skeleton className="h-24" />
      ) : debtors.isError ? (
        // Never "nobody owes" when we simply could not ask.
        <LoadError error={debtors.error} onRetry={() => void debtors.refetch()} />
      ) : (debtors.data ?? []).length === 0 ? (
        <p className="text-sm text-text-secondary">{t('admin.home.noDebtors')}</p>
      ) : (
        <CardList>
          {(debtors.data ?? []).slice(0, limit).map((debtor) => {
            const amount = formatGuarani(debtor.owedGs);
            const link = whatsappUrl(
              debtor.phone,
              t('admin.home.whatsappMessage', {
                name: debtor.firstName,
                box: boxName ?? '',
                amount,
              }),
            );
            return (
              <CardListItem key={debtor.memberId}>
                <Avatar firstName={debtor.firstName} lastName={debtor.lastName} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="line-clamp-2 font-semibold">
                    {debtor.firstName} {debtor.lastName}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {t('admin.home.owed', { amount, date: formatShortDate(debtor.oldestDueOn) })}
                  </span>
                </span>
                {onCollect ? (
                  <Button
                    className="px-3 text-sm"
                    aria-label={t('admin.payments.collectLabel', { name: debtor.firstName })}
                    onClick={() => onCollect(debtor.memberId)}
                  >
                    {t('admin.payments.collect')}
                  </Button>
                ) : null}
                {link ? (
                  <Button
                    asChild
                    variant="secondary"
                    className={onCollect ? 'size-touch shrink-0 px-0' : 'px-3 text-sm'}
                  >
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t('admin.home.whatsappLabel', { name: debtor.firstName })}
                    >
                      <MessageCircle aria-hidden="true" size={16} />
                      {onCollect ? null : t('admin.home.whatsapp')}
                    </a>
                  </Button>
                ) : null}
              </CardListItem>
            );
          })}
        </CardList>
      )}
    </Card>
  );
}
