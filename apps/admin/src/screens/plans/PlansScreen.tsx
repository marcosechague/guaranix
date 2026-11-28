import { formatGuarani, t } from '@guaranix/shared';
import type { Plan } from '@guaranix/shared/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Page,
  PageHeader,
  Skeleton,
} from '@guaranix/ui';
import { LoadError, useBoxClock } from '@guaranix/ui/data';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { usePlans } from '../../api/queries';
import { canManage } from '../../lib/roles';
import { planRule } from './plan-rule';
import { PlanFormSheet } from './PlanFormSheet';

type Editing = { plan: Plan | null } | null;

export function PlansScreen() {
  const { role } = useBoxClock();
  const plans = usePlans();
  const [editing, setEditing] = useState<Editing>(null);
  const manager = canManage(role);

  return (
    <Page layout="panel">
      <PageHeader
        size="large"
        title={t('admin.plans.title')}
        subtitle={t('admin.plans.subtitle')}
        actions={
          manager ? (
            <Button onClick={() => setEditing({ plan: null })}>
              <Plus aria-hidden="true" size={18} />
              {t('admin.plans.new')}
            </Button>
          ) : null
        }
      />
      {plans.isPending ? (
        <div aria-busy="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : plans.isError ? (
        <LoadError error={plans.error} onRetry={() => void plans.refetch()} />
      ) : plans.data.length === 0 ? (
        <EmptyState
          framed
          title={t('admin.plans.emptyTitle')}
          description={t('admin.plans.emptyBody')}
          action={
            manager ? (
              <Button onClick={() => setEditing({ plan: null })}>{t('admin.plans.new')}</Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.data.map((plan) => (
            <Card as="li" key={plan.id} className={plan.isActive ? '' : 'opacity-70'}>
              <div className="flex items-start justify-between gap-3">
                <Badge tone="outline">{t(`plans.kinds.${plan.kind}`)}</Badge>
                <Badge tone={plan.isActive ? 'success' : 'neutral'} dot>
                  {plan.isActive ? t('admin.plans.active') : t('admin.plans.inactive')}
                </Badge>
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="font-display text-xl font-bold">{plan.name}</h2>
                <p className="text-sm text-text-secondary">{planRule(plan)}</p>
              </div>
              <div className="flex items-end justify-between gap-3">
                <div className="flex flex-col">
                  <span className="font-display text-3xl font-bold tabular-nums">
                    {formatGuarani(plan.priceGs)}
                  </span>
                  <span className="text-sm text-text-secondary">
                    {t('plans.perMonth', { days: plan.durationDays })}
                  </span>
                </div>
                {manager ? (
                  <IconButton
                    variant="outline"
                    label={`${t('admin.plans.edit')}: ${plan.name}`}
                    onClick={() => setEditing({ plan })}
                  >
                    <Pencil aria-hidden="true" size={18} />
                  </IconButton>
                ) : null}
              </div>
            </Card>
          ))}
        </ul>
      )}
      <PlanFormSheet
        key={editing?.plan?.id ?? 'new'}
        open={editing !== null}
        plan={editing?.plan ?? null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </Page>
  );
}
