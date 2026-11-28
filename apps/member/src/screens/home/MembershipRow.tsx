import { formatGuarani, formatShortDate, t } from '@guaranix/shared';
import { classNames, Skeleton } from '@guaranix/ui';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { useMyAccount, useMyPlans, usePlans } from '../../api/queries';
import { leftToPayGs } from '../../lib/fees';
import { currentPlanHealth, type PlanHealth } from '../../lib/plan-status';
import { LoadError, useBoxClock } from '@guaranix/ui/data';

function headline(health: PlanHealth): string {
  switch (health.kind) {
    case 'ok':
      return t('member.home.planOk');
    case 'expiring':
      return health.daysLeft === 0
        ? t('member.home.planExpiresToday')
        : t('member.home.planExpiresSoon', { days: health.daysLeft });
    case 'paused':
      return t('member.home.planPaused');
    case 'missing':
      return t('member.home.planMissing');
  }
}

export function MembershipRow() {
  const { today } = useBoxClock();
  const memberPlans = useMyPlans();
  const plans = usePlans();
  const account = useMyAccount();
  if (memberPlans.isPending) return <Skeleton className="h-18 rounded-xl" />;
  if (memberPlans.isError) {
    return <LoadError error={memberPlans.error} onRetry={() => void memberPlans.refetch()} />;
  }
  const health = currentPlanHealth(memberPlans.data ?? [], today);
  const planName =
    health.kind === 'missing'
      ? ''
      : (plans.data?.find((plan) => plan.id === health.plan.planId)?.name ?? '');
  // Money owed outranks the plan's own status: it is what the member has to act on.
  const owed = account.data ? leftToPayGs(account.data) : 0;
  const tone = health.kind === 'ok' && owed === 0 ? 'bg-success' : 'bg-warning';
  return (
    <Link
      to="/cuota"
      aria-label={t('member.home.openFees')}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface px-5 py-4 transition-transform duration-fast ease-out hover:border-text-secondary active:scale-99"
    >
      <span aria-hidden="true" className={classNames('size-2.5 shrink-0 rounded-pill', tone)} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">
          {owed > 0 ? t('member.home.owes', { amount: formatGuarani(owed) }) : headline(health)}
        </span>
        <span className="truncate text-sm text-text-secondary">
          {owed > 0
            ? t('member.home.owesMeta')
            : health.kind === 'missing'
              ? t('member.home.planMissingMeta')
              : t('member.home.planMeta', {
                  plan: planName,
                  date: formatShortDate(health.plan.endsOn),
                })}
        </span>
      </span>
      <ChevronRight aria-hidden="true" size={20} className="shrink-0 text-text-secondary" />
    </Link>
  );
}
