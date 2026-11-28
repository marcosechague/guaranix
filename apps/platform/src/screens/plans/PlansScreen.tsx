import { formatGuarani, type PlatformPlan, t } from '@guaranix/shared';
import { Badge, Button, Card, Page, PageHeader, ProgressBar, Skeleton } from '@guaranix/ui';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { usePlans } from '../../api/queries';
import { PlanSheet } from './PlanSheet';

function PlanCard({ plan, onEdit }: { plan: PlatformPlan; onEdit: () => void }) {
  return (
    <Card as="li" className={plan.isActive ? '' : 'opacity-70'}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-bold">{plan.name}</h2>
          <span className="font-mono text-xs text-text-secondary">{plan.code}</span>
        </div>
        {plan.isActive ? null : <Badge tone="neutral">{t('platform.plans.inactive')}</Badge>}
      </div>
      <p className="flex items-baseline gap-2">
        <span className="font-display text-3xl font-bold tabular-nums">
          {formatGuarani(plan.monthlyPriceGs)}
        </span>
        <span className="text-sm text-text-secondary">{t('platform.plans.perMonth')}</span>
      </p>
      {plan.description ? <p className="text-sm text-text-soft">{plan.description}</p> : null}
      <p className="text-sm text-text-secondary">
        {t('platform.plans.extraLocation', {
          amount: formatGuarani(plan.extraLocationMonthlyPriceGs),
        })}
      </p>
      <div className="mt-auto flex flex-col gap-2">
        {plan.boxLimit === null ? (
          <span className="text-sm font-semibold">
            {t('platform.plans.usage', { count: plan.boxCount })}
          </span>
        ) : (
          <>
            <span className="text-sm font-semibold">
              {t('platform.plans.usageLimit', { count: plan.boxCount, limit: plan.boxLimit })}
            </span>
            <ProgressBar value={plan.boxCount} max={plan.boxLimit} label={plan.name} />
          </>
        )}
        <Button
          variant="secondary"
          className="self-start"
          aria-label={t('platform.plans.edit', { name: plan.name })}
          onClick={onEdit}
        >
          <Pencil aria-hidden="true" size={16} />
          {t('platform.plans.editShort')}
        </Button>
      </div>
    </Card>
  );
}

export function PlansScreen() {
  const { data: plans } = usePlans();
  const [editing, setEditing] = useState<PlatformPlan | 'new' | null>(null);
  return (
    <Page layout="panel">
      <PageHeader
        size="large"
        title={t('platform.plans.title')}
        subtitle={t('platform.plans.subtitle')}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" size={18} />
            {t('platform.plans.new')}
          </Button>
        }
      />
      {plans ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onEdit={() => setEditing(plan)} />
          ))}
        </ul>
      ) : (
        <div aria-busy="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-64 rounded-xl" />
          ))}
        </div>
      )}
      {editing ? (
        <PlanSheet plan={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      ) : null}
    </Page>
  );
}
