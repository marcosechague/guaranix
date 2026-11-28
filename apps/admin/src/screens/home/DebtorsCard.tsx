import { formatGuarani, formatShortDate, t } from '@guaranix/shared';
import { Avatar, Button, Card, Skeleton } from '@guaranix/ui';
import { useBoxClock } from '@guaranix/ui/data';
import { MessageCircle } from 'lucide-react';
import { useDebtors } from '../../api/queries';
import { whatsappUrl } from '../../lib/whatsapp';

const VISIBLE_DEBTORS = 5;

export function DebtorsCard() {
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
      ) : (debtors.data ?? []).length === 0 ? (
        <p className="text-sm text-text-secondary">{t('admin.home.noDebtors')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-divider">
          {(debtors.data ?? []).slice(0, VISIBLE_DEBTORS).map((debtor) => {
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
              <li
                key={debtor.memberId}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Avatar firstName={debtor.firstName} lastName={debtor.lastName} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">
                    {debtor.firstName} {debtor.lastName}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {t('admin.home.owed', { amount, date: formatShortDate(debtor.oldestDueOn) })}
                  </span>
                </span>
                {link ? (
                  <Button asChild variant="secondary" className="px-3 text-sm">
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t('admin.home.whatsappLabel', { name: debtor.firstName })}
                    >
                      <MessageCircle aria-hidden="true" size={16} />
                      {t('admin.home.whatsapp')}
                    </a>
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
