import {
  type PlanFeatureDraft,
  planFeatureChanged,
  planFeatureDraft,
  planFeatureInput,
  type PlanFeatureState,
  featureChanges,
  t,
} from '@guaranix/shared';
import { Eyebrow, FormSaveActions, Skeleton, SwitchField, TextField, useToast } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { useState } from 'react';
import { usePlanFeatures, useSavePlanFeatures } from '../../api/ai';

type FeatureName = PlanFeatureState['feature'];

function PlanFeaturesForm({ planId, features }: { planId: string; features: PlanFeatureState[] }) {
  const toast = useToast();
  const save = useSavePlanFeatures(planId);
  const [drafts, setDrafts] = useState<Map<FeatureName, PlanFeatureDraft>>(
    () => new Map(features.map((state) => [state.feature, planFeatureDraft(state)])),
  );
  const [invalid, setInvalid] = useState<Set<FeatureName>>(new Set());
  const draftOf = (state: PlanFeatureState) => drafts.get(state.feature) ?? planFeatureDraft(state);
  const update = (feature: FeatureName, draft: PlanFeatureDraft) =>
    setDrafts((current) => new Map(current).set(feature, draft));
  const changed = features.filter((state) => planFeatureChanged(draftOf(state), state));

  async function submit() {
    const { invalid: wrong, changes } = featureChanges(
      changed.map((state) => ({ feature: state.feature, input: planFeatureInput(draftOf(state)) })),
    );
    setInvalid(wrong);
    if (wrong.size > 0) return;
    await save.mutateAsync(changes);
    toast.show(t('platform.features.saved'), 'success');
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit().catch(() => undefined);
      }}
    >
      {features.map((state) => {
        const draft = draftOf(state);
        const name = t(`platform.features.names.${state.feature}`);
        return (
          <div key={state.feature} className="flex flex-col gap-2">
            <SwitchField
              label={name}
              description={t(`platform.features.descriptions.${state.feature}`)}
              checked={draft.enabled}
              onChange={(enabled) => update(state.feature, { ...draft, enabled })}
            />
            {draft.enabled ? (
              <TextField
                label={t('platform.features.monthlyLimit')}
                aria-label={`${name}: ${t('platform.features.monthlyLimit')}`}
                hint={t('platform.features.monthlyLimitHint')}
                type="number"
                inputMode="numeric"
                min={0}
                className="pl-4"
                value={draft.limit}
                error={invalid.has(state.feature) ? t('platform.features.invalidLimit') : undefined}
                onChange={(event) => update(state.feature, { ...draft, limit: event.target.value })}
              />
            ) : null}
          </div>
        );
      })}
      <FormSaveActions
        editable
        dirty={changed.length > 0}
        pending={save.isPending}
        error={save.error ? errorText(save.error) : null}
        label={t('platform.features.save')}
      />
    </form>
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
        <PlanFeaturesForm planId={planId} features={features} />
      ) : (
        <Skeleton className="h-32 rounded-lg" />
      )}
    </section>
  );
}
