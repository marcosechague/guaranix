import { formatGuarani, formatShortDate, t } from '@guaranix/shared';
import type { MemberPlan } from '@guaranix/shared/api';
import { Badge, type BadgeTone, Skeleton } from '@guaranix/ui';
import { LoadError } from '@guaranix/ui/data';
import { useMemberPlans, usePlans } from '../../api/queries';

export const PLAN_STATE_TONES: Record<MemberPlan['state'], BadgeTone> = {
  active: 'success',
  upcoming: 'neutral',
  paused: 'warning',
  expired: 'outline',
  cancelled: 'outline',
};

export function MemberPlansList({ memberId }: { memberId: string }) {
  const memberPlans = useMemberPlans(memberId);
  const plans = usePlans();
  if (memberPlans.isPending) return <Skeleton className="h-16" />;
  if (memberPlans.isError) {
    return <LoadError error={memberPlans.error} onRetry={() => void memberPlans.refetch()} />;
  }
  if ((memberPlans.data ?? []).length === 0) {
    return <p className="text-sm text-text-secondary">{t('admin.members.noPlans')}</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-divider rounded-md border border-border">
      {(memberPlans.data ?? []).map((memberPlan) => (
        <li key={memberPlan.id} className="flex items-center gap-3 px-4 py-3">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-semibold">
              {plans.data?.find((plan) => plan.id === memberPlan.planId)?.name}
            </span>
            <span className="text-sm text-text-secondary tabular-nums">
              {t('member.profile.validity', {
                from: formatShortDate(memberPlan.startsOn),
                to: formatShortDate(memberPlan.endsOn),
              })}{' '}
              · {formatGuarani(memberPlan.priceGs)}
            </span>
          </span>
          <Badge tone={PLAN_STATE_TONES[memberPlan.state]} dot>
            {t(`plans.states.${memberPlan.state}`)}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
