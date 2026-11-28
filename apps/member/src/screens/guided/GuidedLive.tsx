import {
  formatDuration,
  formatKilograms,
  type GuidedPlan,
  t,
  type TimerSnapshot,
} from '@guaranix/shared';
import { Button, TapArea } from '@guaranix/ui';
import { Pause, Play, Undo2 } from 'lucide-react';
import type { TimerStatus } from '../timer/use-workout-timer';
import { GuidedNow } from './GuidedNow';
import type { GuidedProgress } from './guided-progress';
import { StepDots } from './StepDots';

export interface GuidedLiveProps {
  plan: GuidedPlan;
  status: TimerStatus;
  snapshot: TimerSnapshot;
  progress: GuidedProgress;
  capLabel: string | null;
  onTap(): void;
  onUndo(): void;
  onPause(): void;
  onResume(): void;
}

const TAP_LABEL = {
  steps: 'member.guided.markStep',
  rounds: 'member.guided.addRound',
  intervals: 'member.guided.followClock',
} as const;

/**
 * During: the whole middle of the screen is one button, so a sweaty hand can
 * hit it from any angle. Undo and pause sit outside it on purpose.
 */
export function GuidedLive({
  plan,
  status,
  snapshot,
  progress,
  capLabel,
  onTap,
  onUndo,
  onPause,
  onResume,
}: GuidedLiveProps) {
  const counting = snapshot.phase === 'countdown';
  const tappable = status === 'running' && !counting && plan.advance !== 'intervals';
  const meta = [
    capLabel,
    progress.loadGrams === null ? null : formatKilograms(progress.loadGrams),
    snapshot.totalRounds === null
      ? null
      : t('member.timer.round', { round: snapshot.round, total: snapshot.totalRounds }),
  ].filter((part): part is string => part !== null);
  const canUndo =
    status === 'running' &&
    (plan.advance === 'steps' ? progress.stepIndex > 0 : progress.rounds > 0);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="text-center">
        <p role="timer" className="font-display text-6xl font-bold tabular-nums md:text-7xl">
          {counting ? formatDuration(0) : formatDuration(snapshot.clockSeconds)}
        </p>
        {meta.length > 0 ? <p className="text-text-secondary">{meta.join(' · ')}</p> : null}
      </div>
      {plan.advance === 'steps' ? (
        <StepDots done={progress.stepIndex} total={plan.sequence.length} />
      ) : null}
      <TapArea
        onClick={tappable ? onTap : undefined}
        aria-disabled={!tappable}
        label={t(TAP_LABEL[plan.advance])}
        data-testid="guided-tap"
        className="flex-1"
      >
        <span aria-live="polite" className="flex flex-col items-center gap-3">
          <GuidedNow plan={plan} snapshot={snapshot} progress={progress} />
        </span>
      </TapArea>
      <p className="text-center text-sm font-semibold text-text-secondary">
        {status === 'paused'
          ? t('member.timer.paused')
          : t(`member.guided.tapHint.${plan.advance}`)}
      </p>
      <div className="flex gap-3">
        {plan.advance === 'intervals' ? null : (
          <Button
            variant="secondary"
            className="h-14 flex-1 rounded-xl"
            disabled={!canUndo}
            onClick={onUndo}
          >
            <Undo2 aria-hidden="true" size={20} />
            {t('member.guided.undo')}
          </Button>
        )}
        {status === 'paused' ? (
          <Button className="h-14 flex-1 rounded-xl" onClick={onResume}>
            <Play aria-hidden="true" size={20} />
            {t('member.timer.resume')}
          </Button>
        ) : (
          <Button variant="secondary" className="h-14 flex-1 rounded-xl" onClick={onPause}>
            <Pause aria-hidden="true" size={20} />
            {t('member.timer.pause')}
          </Button>
        )}
      </div>
    </div>
  );
}
