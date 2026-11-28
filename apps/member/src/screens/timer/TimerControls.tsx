import { t } from '@guaranix/shared';
import { Button } from '@guaranix/ui';
import { Flag, Pause, Play, RotateCcw } from 'lucide-react';
import type { TimerStatus } from './use-workout-timer';

export interface TimerControlsProps {
  status: TimerStatus;
  /** For time ends with the athlete's "done", not with the clock. */
  canFinish: boolean;
  onStart(): void;
  onPause(): void;
  onFinish(): void;
  onReset(): void;
}

const big = 'h-16 flex-1 rounded-xl text-lg';

export function TimerControls({
  status,
  canFinish,
  onStart,
  onPause,
  onFinish,
  onReset,
}: TimerControlsProps) {
  if (status === 'finished') return null;
  return (
    <div className="flex gap-3">
      {status === 'running' ? (
        <Button variant="secondary" className={big} onClick={onPause}>
          <Pause aria-hidden="true" size={22} />
          {t('member.timer.pause')}
        </Button>
      ) : (
        <Button className={big} onClick={onStart}>
          <Play aria-hidden="true" size={22} />
          {status === 'paused' ? t('member.timer.resume') : t('member.timer.start')}
        </Button>
      )}
      {status === 'running' && canFinish ? (
        <Button className={big} onClick={onFinish}>
          <Flag aria-hidden="true" size={22} />
          {t('member.timer.finish')}
        </Button>
      ) : null}
      {status === 'paused' ? (
        <Button variant="secondary" className={big} onClick={onReset}>
          <RotateCcw aria-hidden="true" size={22} />
          {t('member.timer.reset')}
        </Button>
      ) : null}
    </div>
  );
}
