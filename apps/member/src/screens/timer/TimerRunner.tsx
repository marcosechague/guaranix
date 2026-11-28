import {
  COUNTDOWN_SECONDS,
  formatDuration,
  t,
  type TimerPlan,
  type TimerSnapshot,
  timerSnapshot,
} from '@guaranix/shared';
import type { WorkoutComponent } from '@guaranix/shared/api';
import { ProgressBar, useWakeLock } from '@guaranix/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { WorkoutFullScreen } from '../../layout/WorkoutFullScreen';
import { timerChips } from '../../lib/workout-summary';
import { RoundCounter } from './RoundCounter';
import { TimerControls } from './TimerControls';
import { TimerFinished } from './TimerFinished';
import { createTimerFeedback } from './timer-feedback';
import { type TimerStatus, useWorkoutTimer } from './use-workout-timer';

export interface TimerRunnerProps {
  component: WorkoutComponent;
  plan: TimerPlan;
}

const phaseTone = {
  countdown: 'text-text-secondary',
  work: 'text-accent-text',
  rest: 'text-success',
  done: 'text-accent-text',
} as const;

function phaseLabel(status: TimerStatus, snapshot: TimerSnapshot): string {
  if (status === 'idle') return t('member.timer.ready');
  if (status === 'paused') return t('member.timer.paused');
  return t(`member.timer.phases.${snapshot.phase}`);
}

/** Full screen, always dark, readable from the floor: the clock is the screen. */
export function TimerRunner({ component, plan }: TimerRunnerProps) {
  const navigate = useNavigate();
  const [sound, setSound] = useState(true);
  const [rounds, setRounds] = useState(0);
  const [feedback] = useState(createTimerFeedback);
  const timer = useWorkoutTimer(plan, `guaranix:timer:${component.id}`, (cue) =>
    feedback.play(cue, { sound, vibration: true }),
  );
  useWakeLock(timer.status === 'running');

  const { status } = timer;
  // Before starting, show what the clock will read at "go", not the countdown.
  const snapshot =
    status === 'idle' ? timerSnapshot(plan, COUNTDOWN_SECONDS * 1000) : timer.snapshot;
  const isCountdown = status !== 'idle' && snapshot.phase === 'countdown';
  const start = () => {
    feedback.unlock();
    timer.start();
  };

  return (
    <WorkoutFullScreen
      title={component.title ?? t(`workout.kinds.${component.kind}`)}
      badges={timerChips(component)}
      closeLabel={t('member.timer.close')}
      onClose={() => void navigate('/wod')}
      sound={sound}
      onToggleSound={() => setSound((current) => !current)}
    >
      <section
        aria-live="off"
        className="flex flex-1 flex-col items-center justify-center gap-3 text-center"
      >
        <p
          className={`text-sm font-semibold tracking-widest uppercase md:text-base ${
            status === 'running' ? phaseTone[snapshot.phase] : 'text-text-secondary'
          }`}
        >
          {phaseLabel(status, snapshot)}
        </p>
        <p
          role="timer"
          className={`font-display text-clock font-bold tabular-nums ${
            isCountdown ? 'text-text-secondary' : snapshot.phase === 'rest' ? 'text-success' : ''
          }`}
        >
          {isCountdown ? snapshot.clockSeconds : formatDuration(snapshot.clockSeconds)}
        </p>
        {snapshot.totalRounds !== null ? (
          <p className="font-display text-2xl font-semibold text-text-soft md:text-3xl">
            {t('member.timer.round', { round: snapshot.round, total: snapshot.totalRounds })}
          </p>
        ) : null}
        {snapshot.progress !== null ? (
          <ProgressBar
            label={t('member.timer.progress')}
            value={Math.round(snapshot.progress * 100)}
            max={100}
            tone={snapshot.phase === 'rest' ? 'success' : 'accent'}
            className="mt-2 w-full max-w-md"
          />
        ) : null}
      </section>

      {status === 'finished' ? (
        <TimerFinished
          component={component}
          plan={plan}
          snapshot={snapshot}
          rounds={rounds}
          onReset={() => {
            setRounds(0);
            timer.reset();
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {plan.type === 'amrap' ? (
            <RoundCounter rounds={rounds} onChange={setRounds} disabled={status === 'idle'} />
          ) : null}
          <TimerControls
            status={status}
            canFinish={plan.type === 'for_time'}
            onStart={start}
            onPause={timer.pause}
            onFinish={timer.finish}
            onReset={() => {
              setRounds(0);
              timer.reset();
            }}
          />
          {status === 'idle' ? (
            <p className="text-center text-sm text-text-secondary">{t('member.timer.hint')}</p>
          ) : null}
        </div>
      )}
    </WorkoutFullScreen>
  );
}
