import { PLAN_KINDS, type PlanKind, type SetupIssue, t } from '@guaranix/shared';
import { IconButton, MoneyField, SelectField, TextField } from '@guaranix/ui';
import { Trash2 } from 'lucide-react';
import { IssueNotes } from '../IssueNotes';
import type { DraftPlan } from '../signup-draft';

const toNumber = (value: string) => (value === '' ? 0 : Number(value));

/** Limits follow the kind, so switching kinds never leaves an impossible plan. */
function changeKind(plan: DraftPlan, kind: PlanKind): Partial<DraftPlan> {
  if (kind === 'weekly_limit')
    return { kind, classesPerWeek: plan.classesPerWeek ?? 3, classCount: null };
  if (kind === 'class_pack')
    return { kind, classesPerWeek: null, classCount: plan.classCount ?? 10 };
  if (kind === 'drop_in') return { kind, classesPerWeek: null, classCount: 1, durationDays: 7 };
  return { kind, classesPerWeek: null, classCount: null };
}

export interface PlanRowProps {
  plan: DraftPlan;
  issues: readonly SetupIssue[];
  onChange: (changes: Partial<DraftPlan>) => void;
  onRemove: () => void;
}

export function PlanRow({ plan, issues, onChange, onRemove }: PlanRowProps) {
  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex items-end gap-2">
        <TextField
          className="flex-1"
          label={t('onboarding.plans.name')}
          value={plan.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
        <IconButton
          variant="ghost"
          label={t('onboarding.plans.remove', { name: plan.name })}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" className="size-5" />
        </IconButton>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SelectField
          label={t('onboarding.plans.kind')}
          value={plan.kind}
          onChange={(event) => onChange(changeKind(plan, event.target.value as PlanKind))}
        >
          {PLAN_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`plans.kinds.${kind}`)}
            </option>
          ))}
        </SelectField>
        <MoneyField
          label={t('onboarding.plans.price')}
          value={plan.priceGs}
          onValueChange={(priceGs) => onChange({ priceGs: priceGs ?? 0 })}
        />
        {plan.kind === 'weekly_limit' ? (
          <TextField
            label={t('onboarding.plans.classesPerWeek')}
            inputMode="numeric"
            value={String(plan.classesPerWeek ?? '')}
            onChange={(event) => onChange({ classesPerWeek: toNumber(event.target.value) })}
          />
        ) : null}
        {plan.kind === 'class_pack' ? (
          <TextField
            label={t('onboarding.plans.classCount')}
            inputMode="numeric"
            value={String(plan.classCount ?? '')}
            onChange={(event) => onChange({ classCount: toNumber(event.target.value) })}
          />
        ) : null}
        <TextField
          label={t('onboarding.plans.durationDays')}
          inputMode="numeric"
          value={String(plan.durationDays || '')}
          onChange={(event) => onChange({ durationDays: toNumber(event.target.value) })}
        />
      </div>
      <IssueNotes issues={issues} />
    </li>
  );
}
