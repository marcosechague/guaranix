import { formatDuration, t, type TimerPlan, type TimerSnapshot } from '@guaranix/shared';
import type { WorkoutComponent } from '@guaranix/shared/api';
import { Button, Card } from '@guaranix/ui';
import { RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router';
import { timerResultState } from './timer-result';

export interface TimerFinishedProps {
  component: WorkoutComponent;
  plan: TimerPlan;
  snapshot: TimerSnapshot;
  rounds: number;
  onReset(): void;
}

export function TimerFinished({ component, plan, snapshot, rounds, onReset }: TimerFinishedProps) {
  const navigate = useNavigate();
  const hitCap = plan.type === 'for_time' && snapshot.phase === 'done';
  const summary =
    plan.type === 'for_time'
      ? hitCap
        ? t('member.timer.capReached', { time: formatDuration(snapshot.workoutSeconds) })
        : t('member.timer.yourTime', { time: formatDuration(snapshot.workoutSeconds) })
      : plan.type === 'amrap'
        ? t('member.timer.yourRounds', { rounds })
        : t('member.timer.allRounds', { rounds: snapshot.totalRounds ?? 0 });
  const prefill =
    component.scoreType === 'time' && !hitCap
      ? { timeSeconds: snapshot.workoutSeconds }
      : component.scoreType === 'rounds_reps' && plan.type === 'amrap'
        ? { rounds }
        : {};

  return (
    <Card className="flex flex-col gap-4">
      <p className="text-center font-display text-xl font-bold">{summary}</p>
      <div className="flex gap-3">
        <Button variant="secondary" className="h-14 flex-1 rounded-xl" onClick={onReset}>
          <RotateCcw aria-hidden="true" size={20} />
          {t('member.timer.again')}
        </Button>
        {component.scoreType !== 'none' ? (
          <Button
            className="h-14 flex-1 rounded-xl"
            onClick={() => {
              onReset();
              void navigate('/wod', { state: timerResultState(component.id, prefill) });
            }}
          >
            {t('member.timer.logResult')}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
