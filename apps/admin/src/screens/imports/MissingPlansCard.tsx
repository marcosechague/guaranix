import { normalizeText, t, type ImportAnalysis } from '@guaranix/shared';
import { Button, Card, DividedList, Eyebrow } from '@guaranix/ui';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { PlanFormSheet } from '../plans/PlanFormSheet';

/** Plan names rows point to that neither the box nor the plans sheet has, with how many rows use each. */
export function missingPlans(analysis: ImportAnalysis): { name: string; rows: number }[] {
  const byKey = new Map<string, { name: string; rows: number }>();
  for (const row of analysis.rows) {
    const missing = row.errors.some((issue) => issue.code === 'plan_not_found');
    const name = missing ? row.requestedPlanName : null;
    if (!name) continue;
    const key = normalizeText(name);
    const current = byKey.get(key) ?? { name, rows: 0 };
    byKey.set(key, { ...current, rows: current.rows + 1 });
  }
  return [...byKey.values()].sort((first, second) => second.rows - first.rows);
}

export interface MissingPlansCardProps {
  analysis: ImportAnalysis;
  /** Called after a plan is saved, so the rows are checked again. */
  onPlanCreated: () => void;
}

export function MissingPlansCard({ analysis, onPlanCreated }: MissingPlansCardProps) {
  const [creating, setCreating] = useState<string | null>(null);
  const missing = missingPlans(analysis);
  if (missing.length === 0) return null;

  return (
    <Card>
      <div className="flex flex-col gap-1">
        <Eyebrow>{t('admin.imports.preview.missingTitle')}</Eyebrow>
        <p className="text-sm text-text-secondary">{t('admin.imports.preview.missingHint')}</p>
      </div>
      <DividedList>
        {missing.map((plan) => (
          <li key={plan.name} className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-semibold">{plan.name}</span>
              <span className="text-sm text-text-secondary">
                {t('admin.imports.preview.missingRows', { count: plan.rows })}
              </span>
            </div>
            <Button variant="secondary" onClick={() => setCreating(plan.name)}>
              <Plus aria-hidden="true" size={18} />
              {t('admin.imports.preview.createPlan')}
            </Button>
          </li>
        ))}
      </DividedList>
      <PlanFormSheet
        key={creating ?? 'none'}
        open={creating !== null}
        plan={null}
        defaultName={creating ?? undefined}
        onOpenChange={(open) => !open && setCreating(null)}
        onSaved={onPlanCreated}
      />
    </Card>
  );
}
