import { type SetupIssue, t } from '@guaranix/shared';
import { Button, Card } from '@guaranix/ui';
import { Plus } from 'lucide-react';
import { IssueNotes } from '../IssueNotes';
import { issuesAt } from '../issue-text';
import { type DraftPlan, rowId } from '../signup-draft';
import { PlanRow } from './PlanRow';

export interface PlansStepProps {
  plans: DraftPlan[];
  issues: readonly SetupIssue[];
  onPlansChange: (plans: DraftPlan[]) => void;
}

export function PlansStep({ plans, issues, onPlansChange }: PlansStepProps) {
  const update = (id: string, changes: Partial<DraftPlan>) =>
    onPlansChange(plans.map((plan) => (plan.id === id ? { ...plan, ...changes } : plan)));
  const add = () =>
    onPlansChange([
      ...plans,
      {
        id: rowId(),
        name: t('onboarding.plans.newName'),
        kind: 'weekly_limit',
        priceGs: 250_000,
        classesPerWeek: 2,
        classCount: null,
        durationDays: 30,
        programKeys: [],
      },
    ]);

  return (
    <Card spacing="compact">
      <IssueNotes issues={issuesAt(issues, 'plans')} />
      <ul className="flex flex-col divide-y divide-divider">
        {plans.map((plan, index) => (
          <PlanRow
            key={plan.id}
            plan={plan}
            issues={issuesAt(issues, `plans.${index}`)}
            onChange={(changes) => update(plan.id, changes)}
            onRemove={() => onPlansChange(plans.filter((item) => item.id !== plan.id))}
          />
        ))}
      </ul>
      <Button variant="secondary" className="self-start" onClick={add}>
        <Plus aria-hidden="true" className="size-4" />
        {t('onboarding.plans.add')}
      </Button>
    </Card>
  );
}
