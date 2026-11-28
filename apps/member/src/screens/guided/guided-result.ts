import { formatDuration, type GuidedPlan, t, type TimerSnapshot } from '@guaranix/shared';
import type { WorkoutComponent } from '@guaranix/shared/api';
import type { ScoreText } from '../wod/score-form';
import type { GuidedProgress } from './guided-progress';

const kilograms = (grams: number) => String(grams / 1000).replace('.', ',');

/** What the guided WOD measured, as the result form's text, so the member only confirms. */
export function guidedScoreText(
  component: Pick<WorkoutComponent, 'scoreType'>,
  plan: GuidedPlan,
  snapshot: TimerSnapshot,
  progress: GuidedProgress,
): Partial<ScoreText> {
  const score: Partial<ScoreText> = {};
  const completed = plan.advance === 'steps' && progress.stepIndex >= plan.sequence.length;
  if (component.scoreType === 'time' && completed)
    score.time = formatDuration(snapshot.workoutSeconds);
  if (component.scoreType === 'rounds_reps' && plan.advance === 'rounds') {
    score.rounds = String(progress.rounds);
  }
  if (progress.loadGrams !== null) score.load = kilograms(progress.loadGrams);
  return score;
}

/** The headline after the WOD: the time, the cap, the rounds. */
export function guidedSummary(
  plan: GuidedPlan,
  snapshot: TimerSnapshot,
  progress: GuidedProgress,
): string {
  switch (plan.advance) {
    case 'steps':
      return progress.stepIndex >= plan.sequence.length
        ? t('member.timer.yourTime', { time: formatDuration(snapshot.workoutSeconds) })
        : t('member.guided.capReached', {
            time: formatDuration(snapshot.workoutSeconds),
            done: progress.stepIndex,
            total: plan.sequence.length,
          });
    case 'rounds':
      return t('member.timer.yourRounds', { rounds: progress.rounds });
    case 'intervals':
      return t('member.timer.allRounds', { rounds: snapshot.totalRounds ?? 0 });
  }
}
