import {
  COUNTDOWN_SECONDS,
  formatDuration,
  type GuidedPlan,
  t,
  type TimerPlan,
  timerSnapshot,
} from '@guaranix/shared';
import type { WorkoutComponent } from '@guaranix/shared/api';
import { useWakeLock } from '@guaranix/ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { WorkoutFullScreen } from '../../layout/WorkoutFullScreen';
import { timerChips } from '../../lib/workout-summary';
import { createTimerFeedback } from '../timer/timer-feedback';

import { useWorkoutTimer } from '../timer/use-workout-timer';
import { GuidedDone } from './GuidedDone';
import { GuidedLive } from './GuidedLive';
import { GuidedPrep } from './GuidedPrep';
import { guidedScoreText, guidedSummary } from './guided-result';
import { useGuidedProgress } from './use-guided-progress';
import { useSuggestedLoad } from './use-suggested-load';

export interface GuidedRunnerProps {
  component: WorkoutComponent;
  timer: TimerPlan;
  plan: GuidedPlan;
}

/** Full screen and always dark, like the timer: before, during and after the WOD. */
export function GuidedRunner({ component, timer: timerPlan, plan }: GuidedRunnerProps) {
  const navigate = useNavigate();
  const [sound, setSound] = useState(true);
  const [feedback] = useState(createTimerFeedback);
  const timer = useWorkoutTimer(timerPlan, `guaranix:guided-timer:${component.id}`, (cue) =>
    feedback.play(cue, { sound, vibration: true }),
  );
  const progress = useGuidedProgress(`guaranix:guided:${component.id}`, plan);
  const load = useSuggestedLoad(component);
  useWakeLock(timer.status === 'running');

  const suggested = load.suggestion?.suggestedGrams ?? null;
  const { setLoad } = progress;
  const hasLoad = progress.state.loadGrams !== null;
  useEffect(() => {
    if (timer.status === 'idle' && !hasLoad && suggested !== null) setLoad(suggested);
  }, [timer.status, hasLoad, suggested, setLoad]);

  const { status } = timer;
  const snapshot =
    status === 'idle' ? timerSnapshot(timerPlan, COUNTDOWN_SECONDS * 1000) : timer.snapshot;
  const capSeconds = timerPlan.type === 'for_time' ? timerPlan.capSeconds : null;
  const reset = () => {
    progress.reset();
    timer.reset();
  };
  const exit = () => {
    reset();
    void navigate('/wod');
  };

  return (
    <WorkoutFullScreen
      eyebrow={[t('member.guided.title'), timerChips(component)[0]].filter(Boolean).join(' · ')}
      title={component.title ?? t(`workout.kinds.${component.kind}`)}
      closeLabel={t('member.guided.close')}
      onClose={status === 'finished' ? exit : () => void navigate('/wod')}
      sound={sound}
      onToggleSound={() => setSound((current) => !current)}
    >
      {status === 'idle' ? (
        <GuidedPrep
          plan={plan}
          load={load}
          loadGrams={progress.state.loadGrams}
          onLoadChange={setLoad}
          onStart={() => {
            feedback.unlock();
            timer.start();
          }}
        />
      ) : status === 'finished' ? (
        <GuidedDone
          component={component}
          summary={guidedSummary(plan, snapshot, progress.state)}
          score={guidedScoreText(component, plan, snapshot, progress.state)}
          onAgain={reset}
          onExit={exit}
        />
      ) : (
        <GuidedLive
          plan={plan}
          status={status}
          snapshot={snapshot}
          progress={progress.state}
          capLabel={capSeconds ? t('workout.cap', { time: formatDuration(capSeconds) }) : null}
          onTap={() => {
            feedback.play('tick', { sound, vibration: true });
            if (progress.advance(snapshot.workoutSeconds)) timer.finish();
          }}
          onUndo={progress.undo}
          onPause={timer.pause}
          onResume={timer.start}
        />
      )}
    </WorkoutFullScreen>
  );
}
