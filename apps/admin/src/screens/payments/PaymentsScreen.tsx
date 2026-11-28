import { formatGuarani, t } from '@guaranix/shared';
import { Button, Page, PageHeader, StatTile } from '@guaranix/ui';
import { useBoxClock } from '@guaranix/ui/data';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useDebtors, usePayments, usePaymentsToReview } from '../../api/queries';
import { DebtorsCard } from '../home/DebtorsCard';
import { monthInstants } from './month';
import { RecentPaymentsCard } from './RecentPaymentsCard';
import { RegisterPaymentSheet } from './RegisterPaymentSheet';
import { ReviewQueueCard } from './ReviewQueueCard';

type Registering = { memberId: string | null } | null;

const total = (amounts: readonly { amountGs?: number; owedGs?: number }[]) =>
  amounts.reduce((sum, entry) => sum + (entry.amountGs ?? entry.owedGs ?? 0), 0);

export function PaymentsScreen() {
  const { today, timeZone } = useBoxClock();
  const month = monthInstants(today, timeZone);
  const payments = usePayments(month.from, month.to);
  const toReview = usePaymentsToReview();
  const debtors = useDebtors(true);
  const [registering, setRegistering] = useState<Registering>(null);
  const confirmed = (payments.data ?? []).filter((payment) => payment.status === 'confirmed');
  const summaryValue = (ready: boolean, amount: number) => (ready ? formatGuarani(amount) : '—');

  return (
    <Page layout="panel">
      <PageHeader
        size="large"
        title={t('admin.payments.title')}
        subtitle={t('admin.payments.subtitle')}
        actions={
          <Button onClick={() => setRegistering({ memberId: null })}>
            <Plus aria-hidden="true" size={18} />
            {t('admin.payments.register')}
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          labelFirst
          size="md"
          label={t('admin.payments.collectedMonth', { month: month.name })}
          value={summaryValue(payments.data !== undefined, total(confirmed))}
          hint={t('admin.payments.paymentsCount', { count: confirmed.length })}
        />
        <StatTile
          labelFirst
          size="md"
          label={t('admin.payments.toReview')}
          value={summaryValue(toReview.data !== undefined, total(toReview.data ?? []))}
          hint={t('admin.payments.toReviewCount', { count: toReview.data?.length ?? 0 })}
        />
        <StatTile
          labelFirst
          size="md"
          label={t('admin.payments.overdue')}
          value={summaryValue(debtors.data !== undefined, total(debtors.data ?? []))}
          hint={t('admin.payments.debtorsCount', { count: debtors.data?.length ?? 0 })}
        />
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-3">
          <ReviewQueueCard />
          <RecentPaymentsCard payments={payments.data} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <DebtorsCard onCollect={(memberId) => setRegistering({ memberId })} limit={20} />
        </div>
      </div>
      {registering ? (
        <RegisterPaymentSheet
          initialMemberId={registering.memberId}
          onClose={() => setRegistering(null)}
        />
      ) : null}
    </Page>
  );
}
