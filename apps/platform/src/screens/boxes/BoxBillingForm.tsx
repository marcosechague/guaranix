import { formatGuarani, type PlatformBoxSummary, t } from '@guaranix/shared';
import { FormSaveActions, SelectField, TextField, useToast } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { useState } from 'react';
import { useBoxMutations, usePlans } from '../../api/queries';
import { dateInputValue } from '../../lib/box-status';

/** Plan, extra locations and trial end: what changes what the box pays GuaraniX. */
export function BoxBillingForm({ box }: { box: PlatformBoxSummary }) {
  const toast = useToast();
  const { data: plans = [] } = usePlans();
  const { update } = useBoxMutations(box.id);
  const [planId, setPlanId] = useState(box.platformPlan?.id ?? '');
  const [extraLocations, setExtraLocations] = useState(String(box.extraLocations));
  const [trialEndsOn, setTrialEndsOn] = useState(dateInputValue(box.trialEndsAt));
  const selected = plans.find((plan) => plan.id === planId);
  const dirty =
    planId !== (box.platformPlan?.id ?? '') ||
    extraLocations !== String(box.extraLocations) ||
    trialEndsOn !== dateInputValue(box.trialEndsAt);

  async function save() {
    await update.mutateAsync({
      ...(planId && planId !== box.platformPlan?.id ? { platformPlanId: planId } : {}),
      extraLocations: Math.max(0, Number.parseInt(extraLocations, 10) || 0),
      ...(box.status === 'trial' && trialEndsOn
        ? { trialEndsAt: new Date(`${trialEndsOn}T23:59:00-03:00`) }
        : {}),
    });
    toast.show(t('platform.box.saved'), 'success');
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save().catch(() => undefined);
      }}
    >
      <SelectField
        label={t('platform.box.plan')}
        value={planId}
        onChange={(event) => setPlanId(event.target.value)}
      >
        {plans.map((plan) => (
          <option
            key={plan.id}
            value={plan.id}
            disabled={!plan.isActive && plan.id !== box.platformPlan?.id}
          >
            {t('platform.newBox.planOption', {
              name: plan.name,
              amount: formatGuarani(plan.monthlyPriceGs),
            })}
          </option>
        ))}
      </SelectField>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={t('platform.box.extraLocations')}
          type="number"
          inputMode="numeric"
          min={0}
          max={50}
          value={extraLocations}
          {...(selected
            ? {
                hint: t('platform.box.extraLocationsHint', {
                  amount: formatGuarani(selected.extraLocationMonthlyPriceGs),
                }),
              }
            : {})}
          onChange={(event) => setExtraLocations(event.target.value)}
        />
        {box.status === 'trial' ? (
          <TextField
            label={t('platform.box.trialEndsAt')}
            type="date"
            value={trialEndsOn}
            onChange={(event) => setTrialEndsOn(event.target.value)}
          />
        ) : null}
      </div>
      <FormSaveActions
        editable
        dirty={dirty}
        pending={update.isPending}
        error={update.error ? errorText(update.error) : null}
      />
    </form>
  );
}
