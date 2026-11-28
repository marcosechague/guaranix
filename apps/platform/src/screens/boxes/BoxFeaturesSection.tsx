import { type BoxFeatureState, type FeatureSetting, t } from '@guaranix/shared';
import { Eyebrow, SegmentedControl, Skeleton, useToast } from '@guaranix/ui';
import { useState } from 'react';
import { useBoxFeatures, useSaveBoxFeature } from '../../api/ai';
import { FeatureEditor } from '../../components/FeatureEditor';
import { limitText, parseMonthlyLimit } from '../../lib/feature-limit';

type OverrideMode = 'plan' | 'on' | 'off';

const MODES: readonly { value: OverrideMode; label: string }[] = [
  { value: 'plan', label: t('platform.features.overrides.plan') },
  { value: 'on', label: t('platform.features.overrides.on') },
  { value: 'off', label: t('platform.features.overrides.off') },
];

function modeOf(state: BoxFeatureState): OverrideMode {
  if (state.override?.enabled === true) return 'on';
  if (state.override?.enabled === false) return 'off';
  return 'plan';
}

const limitLabel = (limit: number | null) =>
  limit === null
    ? t('platform.features.unlimited')
    : t('platform.features.perMonth', { count: limit });

function planLine({ enabled, monthlyLimit }: FeatureSetting) {
  return enabled
    ? t('platform.features.fromPlanOn', { limit: limitLabel(monthlyLimit) })
    : t('platform.features.fromPlanOff');
}

function BoxFeatureRow({ boxId, state }: { boxId: string; state: BoxFeatureState }) {
  const toast = useToast();
  const save = useSaveBoxFeature(boxId);
  const [mode, setMode] = useState<OverrideMode>(modeOf(state));
  const [limit, setLimit] = useState(limitText(state.override?.monthlyLimit ?? null));
  const [invalid, setInvalid] = useState(false);
  const { effective, usedThisMonth } = state;

  async function submit() {
    const monthlyLimit = parseMonthlyLimit(limit);
    setInvalid(monthlyLimit === 'invalid');
    if (monthlyLimit === 'invalid') return;
    const enabled = mode === 'plan' ? null : mode === 'on';
    await save.mutateAsync({ feature: state.feature, enabled, monthlyLimit });
    toast.show(t('platform.features.saved'), 'success');
  }

  return (
    <FeatureEditor
      limitLabel={t('platform.features.ownLimit')}
      limitHint={t('platform.features.ownLimitHint')}
      limit={limit}
      onLimitChange={setLimit}
      limitDisabled={mode === 'off'}
      invalid={invalid}
      error={save.error}
      pending={save.isPending}
      onSave={submit}
    >
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold">{t(`platform.features.names.${state.feature}`)}</span>
        <span className="text-sm text-text-secondary">{planLine(state.plan)}</span>
        {effective.enabled ? (
          <span className="text-sm text-text-secondary tabular-nums">
            {effective.monthlyLimit === null
              ? t('platform.features.usedUnlimited', { used: usedThisMonth })
              : t('platform.features.used', { used: usedThisMonth, limit: effective.monthlyLimit })}
          </span>
        ) : null}
      </div>
      <SegmentedControl
        label={t('platform.features.override')}
        options={MODES}
        value={mode}
        onChange={setMode}
      />
    </FeatureEditor>
  );
}

/** What this box can use beyond its plan, or less: decided by the platform, audited on the box. */
export function BoxFeaturesSection({ boxId }: { boxId: string }) {
  const { data: features } = useBoxFeatures(boxId);
  return (
    <section className="flex flex-col gap-3">
      <Eyebrow>{t('platform.features.boxTitle')}</Eyebrow>
      {features ? (
        features.map((state) => (
          <BoxFeatureRow
            key={`${state.feature}-${state.override?.enabled}-${state.override?.monthlyLimit}`}
            boxId={boxId}
            state={state}
          />
        ))
      ) : (
        <Skeleton className="h-32 rounded-lg" />
      )}
    </section>
  );
}
