import {
  type BoxFeatureDraft,
  type BoxFeatureState,
  boxFeatureChanged,
  boxFeatureDraft,
  boxFeatureInput,
  featureChanges,
  t,
} from '@guaranix/shared';
import { Card, FormSaveActions, Skeleton, useToast } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { useState } from 'react';
import { useBoxFeatures, useSaveBoxFeatures } from '../../api/ai';
import { BoxFeatureRow } from './BoxFeatureRow';

type FeatureName = BoxFeatureState['feature'];

function BoxFeaturesForm({ boxId, features }: { boxId: string; features: BoxFeatureState[] }) {
  const toast = useToast();
  const save = useSaveBoxFeatures(boxId);
  const [drafts, setDrafts] = useState<Map<FeatureName, BoxFeatureDraft>>(
    () => new Map(features.map((state) => [state.feature, boxFeatureDraft(state)])),
  );
  const [invalid, setInvalid] = useState<Set<FeatureName>>(new Set());
  const draftOf = (state: BoxFeatureState) => drafts.get(state.feature) ?? boxFeatureDraft(state);
  const changed = features.filter((state) => boxFeatureChanged(draftOf(state), state));

  async function submit() {
    const { invalid: wrong, changes } = featureChanges(
      changed.map((state) => ({
        feature: state.feature,
        input: boxFeatureInput(draftOf(state), state.plan),
      })),
    );
    setInvalid(wrong);
    if (wrong.size > 0) return;
    await save.mutateAsync(changes);
    toast.show(t('platform.features.saved'), 'success');
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit().catch(() => undefined);
      }}
    >
      <ul className="flex flex-col divide-y divide-divider">
        {features.map((state) => (
          <BoxFeatureRow
            key={state.feature}
            state={state}
            draft={draftOf(state)}
            invalid={invalid.has(state.feature)}
            onChange={(draft) => setDrafts((current) => new Map(current).set(state.feature, draft))}
          />
        ))}
      </ul>
      <FormSaveActions
        editable
        dirty={changed.length > 0}
        pending={save.isPending}
        error={save.error ? errorText(save.error) : null}
      />
    </form>
  );
}

/** What this box can use beyond its plan, or less: decided by the platform, audited on the box. */
export function BoxFeaturesSection({ boxId }: { boxId: string }) {
  const { data: features } = useBoxFeatures(boxId);
  return (
    <Card>
      <p className="text-sm text-text-secondary">{t('platform.features.boxHint')}</p>
      {features ? (
        <BoxFeaturesForm boxId={boxId} features={features} />
      ) : (
        <Skeleton className="h-48 rounded-lg" />
      )}
    </Card>
  );
}
