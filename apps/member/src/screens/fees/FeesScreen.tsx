import { formatShortDate, t } from '@guaranix/shared';
import { Columns, Page, PageHeader, Skeleton } from '@guaranix/ui';
import { LoadError, useBoxClock } from '@guaranix/ui/data';
import { useState } from 'react';
import { useMe, useMyAccount, useMyPlans, usePlans } from '../../api/queries';
import { currentPlanHealth } from '../../lib/plan-status';
import { CardEntryLink } from '../card/CardEntryLink';
import { ChargesCard } from './ChargesCard';
import { FeeSummaryCard } from './FeeSummaryCard';
import { PaymentHistoryCard } from './PaymentHistoryCard';
import { ReportPaymentSheet } from './ReportPaymentSheet';

export function FeesScreen() {
  const { today, timeZone } = useBoxClock();
  const account = useMyAccount();
  const me = useMe();
  const [reporting, setReporting] = useState(false);
  const health = currentPlanHealth(useMyPlans().data ?? [], today);
  const plans = usePlans();
  const planName =
    health.kind === 'missing'
      ? null
      : plans.data?.find((plan) => plan.id === health.plan.planId)?.name;
  const subtitle =
    health.kind !== 'missing' && planName
      ? t('member.home.planMeta', { plan: planName, date: formatShortDate(health.plan.endsOn) })
      : t('member.fees.subtitle');

  return (
    <Page layout="mobile">
      <PageHeader size="large" title={t('member.fees.title')} subtitle={subtitle} />
      {account.isPending ? (
        <>
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </>
      ) : account.isError ? (
        <LoadError error={account.error} onRetry={() => void account.refetch()} />
      ) : (
        <Columns
          start={
            <>
              <FeeSummaryCard
                account={account.data}
                today={today}
                onReport={() => setReporting(true)}
              />
              <CardEntryLink />
              <ChargesCard account={account.data} today={today} />
            </>
          }
          end={<PaymentHistoryCard account={account.data} timeZone={timeZone} />}
        />
      )}
      {reporting && account.data && me.data ? (
        <ReportPaymentSheet
          memberId={me.data.id}
          account={account.data}
          onClose={() => setReporting(false)}
        />
      ) : null}
    </Page>
  );
}
