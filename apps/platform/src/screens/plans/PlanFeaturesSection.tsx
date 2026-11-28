import { type PlanFeatureState, t } from '@guaranix/shared';
import { Eyebrow, Skeleton, SwitchField, useToast } from '@guaranix/ui';
import { useState } from 'react';
import { usePlanFeatures, useSavePlanFeature } from '../../api/ai';
import { FeatureEditor } from '../../components/FeatureEditor';
import { limitText, parseMonthlyLimit } from '../../lib/feature-limit';

function PlanFeatureRow({ planId, state }: { planId: string; state: PlanFeatureState }) {
  const toast = useToast();
  const save = useSavePlanFeature(planId);
  const [enabled, setEnabled] = useState(state.enabled);
  const [limit, setLimit] = useState(limitText(state.monthlyLimit));
  const [invalid, setInvalid] = useState(false);

  async function submit() {
    const monthlyLimit = parseMonthlyLimit(limit);
    setInvalid(monthlyLimit === 'invalid');
    if (monthlyLimit === 'invalid') return;
    await save.mutateAsync({ feature: state.feature, enabled, monthlyLimit });
    toast.show(t('platform.features.saved'), 'success');
  }

  return (
    <FeatureEditor
      limitLabel={t('platform.features.monthlyLimit')}
      limitHint={t('platform.features.monthlyLimitHint')}
      limit={limit}
      onLimitChange={setLimit}
      limitDisabled={!enabled}
      invalid={invalid}
      error={save.error}
      pending={save.isPending}
      onSave={submit}
    >
      <SwitchField
        label={t(`platform.features.names.${state.feature}`)}
        description={t(`platform.features.descriptions.${state.feature}`)}
        checked={enabled}
        onChange={setEnabled}
      />
    </FeatureEditor>
  );
}

/** Paid extras of a GuaraniX plan, saved on their own so the price form stays simple. */
export function PlanFeaturesSection({ planId }: { planId: string }) {
  const { data: features } = usePlanFeatures(planId);
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-6">
      <div className="flex flex-col gap-1">
        <Eyebrow>{t('platform.features.title')}</Eyebrow>
        <p className="text-sm text-text-secondary">{t('platform.features.planHint')}</p>
      </div>
      {features ? (
        features.map((state) => (
          <PlanFeatureRow key={state.feature} planId={planId} state={state} />
        ))
      ) : (
        <Skeleton className="h-32 rounded-lg" />
      )}
    </section>
  );
}
