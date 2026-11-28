import {
  type BoxFeatureDraft,
  type BoxFeatureState,
  draftEnabled,
  type FeatureOverrideMode,
  t,
} from '@guaranix/shared';
import { Badge, SelectField, TextField } from '@guaranix/ui';

const MODES: readonly FeatureOverrideMode[] = ['plan', 'on', 'off'];

const limitLabel = (limit: number | null) =>
  limit === null
    ? t('platform.features.unlimited')
    : t('platform.features.perMonth', { count: limit });

export interface BoxFeatureRowProps {
  state: BoxFeatureState;
  draft: BoxFeatureDraft;
  invalid: boolean;
  onChange: (draft: BoxFeatureDraft) => void;
}

/** One feature in a line: what the plan gives, what this box gets, and its limit only when on. */
export function BoxFeatureRow({ state, draft, invalid, onChange }: BoxFeatureRowProps) {
  const name = t(`platform.features.names.${state.feature}`);
  const enabled = draftEnabled(draft, state.plan);
  const { effective, usedThisMonth } = state;

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-start md:justify-between md:gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{name}</span>
          <Badge tone={enabled ? 'success' : 'neutral'}>
            {t(enabled ? 'platform.features.on' : 'platform.features.off')}
          </Badge>
        </span>
        <span className="text-sm text-text-secondary">
          {state.plan.enabled
            ? t('platform.features.included', { limit: limitLabel(state.plan.monthlyLimit) })
            : t('platform.features.notIncluded')}
        </span>
        {effective.enabled ? (
          <span className="text-sm text-text-secondary tabular-nums">
            {effective.monthlyLimit === null
              ? t('platform.features.usedUnlimited', { used: usedThisMonth })
              : t('platform.features.used', { used: usedThisMonth, limit: effective.monthlyLimit })}
          </span>
        ) : null}
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-3 md:w-96">
        <SelectField
          label={t('platform.features.override')}
          aria-label={`${name}: ${t('platform.features.override')}`}
          value={draft.mode}
          onChange={(event) =>
            onChange({ ...draft, mode: event.target.value as FeatureOverrideMode })
          }
        >
          {MODES.map((mode) => (
            <option key={mode} value={mode}>
              {t(`platform.features.overrides.${mode}`)}
            </option>
          ))}
        </SelectField>
        {enabled ? (
          <TextField
            label={t('platform.features.ownLimitShort')}
            aria-label={`${name}: ${t('platform.features.ownLimitShort')}`}
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={
              state.plan.enabled && state.plan.monthlyLimit !== null
                ? t('platform.features.ownLimitPlaceholder', {
                    limit: String(state.plan.monthlyLimit),
                  })
                : t('platform.features.noLimit')
            }
            value={draft.limit}
            error={invalid ? t('platform.features.invalidLimit') : undefined}
            onChange={(event) => onChange({ ...draft, limit: event.target.value })}
          />
        ) : null}
      </div>
    </li>
  );
}
