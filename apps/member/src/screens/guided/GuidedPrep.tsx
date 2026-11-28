import { type GuidedPlan, t } from '@guaranix/shared';
import { Button } from '@guaranix/ui';
import { Play } from 'lucide-react';
import { LoadPicker } from './LoadPicker';
import { StepList } from './StepList';
import type { useSuggestedLoad } from './use-suggested-load';

export interface GuidedPrepProps {
  plan: GuidedPlan;
  load: ReturnType<typeof useSuggestedLoad>;
  loadGrams: number | null;
  onLoadChange(loadGrams: number): void;
  onStart(): void;
}

/** Before: what's coming and the weight, then one big "Empezar". */
export function GuidedPrep({ plan, load, loadGrams, onLoadChange, onStart }: GuidedPrepProps) {
  const roundsTitle =
    plan.advance === 'steps' && plan.rounds > 1
      ? t('member.guided.roundsTimes', { rounds: plan.rounds })
      : t('member.guided.movements');
  return (
    <div className="flex flex-1 flex-col gap-4">
      <StepList title={roundsTitle} steps={plan.steps} />
      {load.takesLoad ? (
        <LoadPicker
          loadGrams={loadGrams}
          onChange={onLoadChange}
          suggestion={load.suggestion}
          movementName={load.movementName}
        />
      ) : null}
      <div className="mt-auto flex flex-col gap-3 pt-2">
        <Button className="h-16 rounded-xl text-lg" onClick={onStart}>
          <Play aria-hidden="true" size={22} />
          {t('member.guided.start')}
        </Button>
        <p className="text-center text-sm text-text-secondary">
          {t(`member.guided.hint.${plan.advance}`)}
        </p>
      </div>
    </div>
  );
}
