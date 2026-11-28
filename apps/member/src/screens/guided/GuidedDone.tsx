import { t } from '@guaranix/shared';
import type { WorkoutComponent } from '@guaranix/shared/api';
import { Button } from '@guaranix/ui';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { ResultCard } from '../wod/ResultCard';
import type { ScoreText } from '../wod/score-form';

export interface GuidedDoneProps {
  component: WorkoutComponent;
  summary: string;
  score: Partial<ScoreText>;
  onAgain(): void;
  onExit(): void;
}

/** After: the result already filled in; the member checks Rx or scaled and saves. */
export function GuidedDone({ component, summary, score, onAgain, onExit }: GuidedDoneProps) {
  const [saved, setSaved] = useState(component.scoreType === 'none');
  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="text-center font-display text-3xl font-bold md:text-4xl">{summary}</p>
      {component.scoreType === 'none' ? null : (
        <ResultCard
          component={component}
          ownEntry={undefined}
          fromTimer={score}
          onSaved={() => setSaved(true)}
        />
      )}
      <div className="mt-auto flex gap-3 pt-2">
        <Button variant="secondary" className="h-14 flex-1 rounded-xl" onClick={onAgain}>
          <RotateCcw aria-hidden="true" size={20} />
          {t('member.timer.again')}
        </Button>
        <Button
          variant={saved ? 'primary' : 'ghost'}
          className="h-14 flex-1 rounded-xl"
          onClick={onExit}
        >
          {t('member.timer.backToWod')}
        </Button>
      </div>
    </div>
  );
}
