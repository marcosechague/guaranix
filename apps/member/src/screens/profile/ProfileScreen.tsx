import { formatGuarani, formatShortDate, t } from '@guaranix/shared';
import type { MemberPlan } from '@guaranix/shared/api';
import {
  Avatar,
  Badge,
  Page,
  type BadgeTone,
  Card,
  EmptyState,
  Eyebrow,
  Skeleton,
} from '@guaranix/ui';
import { AccountSecurity, useSession } from '@guaranix/ui/auth';
import { useMe, useMyPlans, usePlans } from '../../api/queries';
import { useBoxClock } from '@guaranix/ui/data';

const STATE_TONES: Record<MemberPlan['state'], BadgeTone> = {
  active: 'success',
  upcoming: 'neutral',
  paused: 'warning',
  expired: 'outline',
  cancelled: 'outline',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function PlanCard() {
  const memberPlans = useMyPlans();
  const plans = usePlans();
  if (memberPlans.isPending) return <Skeleton className="h-52 rounded-xl" />;
  const current =
    memberPlans.data?.find((plan) => plan.state === 'active' || plan.state === 'paused') ??
    memberPlans.data?.find((plan) => plan.state === 'upcoming');
  if (!current) {
    return (
      <Card>
        <EmptyState
          title={t('member.profile.noPlanTitle')}
          description={t('member.profile.noPlanBody')}
        />
      </Card>
    );
  }
  const plan = plans.data?.find((item) => item.id === current.planId);
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>{t('member.profile.plan')}</Eyebrow>
        <Badge tone={STATE_TONES[current.state]} dot>
          {t(`plans.states.${current.state}`)}
        </Badge>
      </div>
      <h2 className="font-display text-2xl font-bold">{plan?.name}</h2>
      <dl className="divide-y divide-divider">
        <Row
          label={t('member.profile.validityLabel')}
          value={t('member.profile.validity', {
            from: formatShortDate(current.startsOn),
            to: formatShortDate(current.endsOn),
          })}
        />
        <Row label={t('member.profile.price')} value={formatGuarani(current.priceGs)} />
        {current.classesRemaining !== null ? (
          <Row label={t('member.profile.credits')} value={String(current.classesRemaining)} />
        ) : null}
        {current.pauses.map((pause) => (
          <Row
            key={pause.id}
            label={t('member.profile.pauses')}
            value={t('member.profile.pauseRange', {
              from: formatShortDate(pause.startsOn),
              to: formatShortDate(pause.endsOn),
            })}
          />
        ))}
      </dl>
    </Card>
  );
}

export function ProfileScreen() {
  const session = useSession();
  const { boxName } = useBoxClock();
  const { data: me } = useMe();
  const [first = '', ...rest] = session.user.fullName.split(' ');
  return (
    <Page layout="mobile" className="gap-4">
      <header className="flex items-center gap-4">
        <Avatar
          firstName={me?.firstName ?? first}
          lastName={me?.lastName ?? rest.join(' ')}
          className="size-16 text-lg"
        />
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate font-display text-2xl font-bold">
            {me ? `${me.firstName} ${me.lastName}` : session.user.fullName}
          </h1>
          <span className="truncate text-sm text-text-secondary">
            {[boxName, session.user.email].filter(Boolean).join(' · ')}
          </span>
        </div>
      </header>
      <PlanCard />
      <AccountSecurity />
    </Page>
  );
}
