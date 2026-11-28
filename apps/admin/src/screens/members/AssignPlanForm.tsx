import { formatGuarani, t } from '@guaranix/shared';
import { Button, FormMessage, SelectField, TextField, useToast } from '@guaranix/ui';
import { errorText, useBoxClock } from '@guaranix/ui/data';
import { useState } from 'react';
import { useAssignPlan } from '../../api/mutations';
import { usePlans } from '../../api/queries';

/** Sell a plan at the front desk: pick it, pick the start date, done. */
export function AssignPlanForm({ memberId }: { memberId: string }) {
  const { today } = useBoxClock();
  const plans = usePlans();
  const assign = useAssignPlan(memberId);
  const toast = useToast();
  const onSale = (plans.data ?? []).filter((plan) => plan.isActive);
  const [planId, setPlanId] = useState('');
  const [startsOn, setStartsOn] = useState(today);
  const selected = planId || onSale[0]?.id || '';

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-dashed border-border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!selected) return;
        assign.mutate(
          { planId: selected, startsOn },
          { onSuccess: () => toast.show(t('admin.members.assigned')) },
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label={t('admin.members.plan')}
          value={selected}
          onChange={(event) => setPlanId(event.target.value)}
        >
          {onSale.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} · {formatGuarani(plan.priceGs)}
            </option>
          ))}
        </SelectField>
        <TextField
          label={t('admin.members.startsOn')}
          type="date"
          value={startsOn}
          onChange={(event) => setStartsOn(event.target.value)}
        />
      </div>
      {assign.isError ? <FormMessage tone="error">{errorText(assign.error)}</FormMessage> : null}
      <Button type="submit" variant="secondary" disabled={assign.isPending || !selected}>
        {t('admin.members.assignPlan')}
      </Button>
    </form>
  );
}
