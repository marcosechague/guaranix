import { formatShortDate, t } from '@guaranix/shared';
import { classNames, Skeleton } from '@guaranix/ui';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { useMyPlans, usePlans } from '../../api/queries';
import { currentPlanHealth, type PlanHealth } from '../../lib/plan-status';
import { useBoxClock } from '../../lib/use-box-clock';

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
  if (memberPlans.isPending) return <Skeleton className="h-18 rounded-xl" />;
  const health = currentPlanHealth(memberPlans.data ?? [], today);
  const planName =
    health.kind === 'missing'
      ? ''
      : (plans.data?.find((plan) => plan.id === health.plan.planId)?.name ?? '');
  const tone = health.kind === 'ok' ? 'bg-success' : 'bg-warning';
  return (
    <Link
      to="/perfil"
      aria-label={t('member.home.openPlan')}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface px-5 py-4 transition-transform duration-fast ease-out hover:border-text-secondary active:scale-[0.99]"
    >
      <span aria-hidden="true" className={classNames('size-2.5 shrink-0 rounded-pill', tone)} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">{headline(health)}</span>
        <span className="truncate text-sm text-text-secondary">
          {health.kind === 'missing'
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
