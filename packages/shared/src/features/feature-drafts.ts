import type {
  BoxFeatureInput,
  BoxFeatureState,
  FeatureSetting,
  PlanFeatureInput,
  PlanFeatureState,
} from '../schemas/features';

/** What the platform decides for one box: follow its plan, force it on or force it off. */
export type FeatureOverrideMode = 'plan' | 'on' | 'off';

/** A feature row while it is being edited; the limit is the raw text of its field. */
export interface BoxFeatureDraft {
  mode: FeatureOverrideMode;
  limit: string;
}

export interface PlanFeatureDraft {
  enabled: boolean;
  limit: string;
}

/** Text field value to a monthly limit: empty means no limit, anything else must be a whole number. */
export function parseMonthlyLimit(value: string): number | null | 'invalid' {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (!/^\d+$/.test(trimmed) || Number(trimmed) > 100_000) return 'invalid';
  return Number(trimmed);
}

const limitText = (limit: number | null) => (limit === null ? '' : String(limit));

export function boxFeatureDraft(state: BoxFeatureState): BoxFeatureDraft {
  const enabled = state.override?.enabled;
  return {
    mode: enabled === true ? 'on' : enabled === false ? 'off' : 'plan',
    limit: limitText(state.override?.monthlyLimit ?? null),
  };
}

/** Whether the box would have the feature with this draft, so its own limit matters. */
export function draftEnabled(draft: BoxFeatureDraft, plan: FeatureSetting): boolean {
  return draft.mode === 'plan' ? plan.enabled : draft.mode === 'on';
}

/**
 * The override to save. A limit only counts while the feature is on: an "off"
 * box, or a plan that does not include it, never keeps a stale limit.
 */
export function boxFeatureInput(
  draft: BoxFeatureDraft,
  plan: FeatureSetting,
): BoxFeatureInput | 'invalid' {
  const monthlyLimit = draftEnabled(draft, plan) ? parseMonthlyLimit(draft.limit) : null;
  if (monthlyLimit === 'invalid') return 'invalid';
  return { enabled: draft.mode === 'plan' ? null : draft.mode === 'on', monthlyLimit };
}

export function boxFeatureChanged(draft: BoxFeatureDraft, state: BoxFeatureState): boolean {
  const saved = boxFeatureDraft(state);
  if (draft.mode !== saved.mode) return true;
  return draftEnabled(draft, state.plan) && draft.limit.trim() !== saved.limit;
}

export function planFeatureDraft(state: PlanFeatureState): PlanFeatureDraft {
  return { enabled: state.enabled, limit: limitText(state.monthlyLimit) };
}

export function planFeatureInput(draft: PlanFeatureDraft): PlanFeatureInput | 'invalid' {
  const monthlyLimit = draft.enabled ? parseMonthlyLimit(draft.limit) : null;
  if (monthlyLimit === 'invalid') return 'invalid';
  return { enabled: draft.enabled, monthlyLimit };
}

export function planFeatureChanged(draft: PlanFeatureDraft, state: PlanFeatureState): boolean {
  if (draft.enabled !== state.enabled) return true;
  return draft.enabled && draft.limit.trim() !== limitText(state.monthlyLimit);
}

/** Splits the changed rows of a features form into what to save and which rows are wrong. */
export function featureChanges<Feature extends string, Input extends object>(
  rows: readonly { feature: Feature; input: Input | 'invalid' }[],
): { invalid: Set<Feature>; changes: (Input & { feature: Feature })[] } {
  const invalid = new Set<Feature>();
  const changes: (Input & { feature: Feature })[] = [];
  for (const { feature, input } of rows) {
    if (input === 'invalid') invalid.add(feature);
    else changes.push({ ...input, feature });
  }
  return { invalid, changes };
}
