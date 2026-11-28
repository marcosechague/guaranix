import { type TimerCue, type TimerPlan, timerCue, timerSnapshot } from '@guaranix/shared';
import { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

interface ClockState {
  status: TimerStatus;
  /** Epoch ms when the clock last started running; null unless running. */
  runningSince: number | null;
  /** Running time banked before the last pause, countdown included. */
  bankedMs: number;
}

const IDLE: ClockState = { status: 'idle', runningSince: null, bankedMs: 0 };
// The clock only shows whole seconds; 4 checks a second keeps it on time without draining the battery.
const TICK_MS = 250;

function readClock(storageKey: string): ClockState {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return IDLE;
    const parsed = JSON.parse(raw) as Partial<ClockState>;
    if (typeof parsed.bankedMs !== 'number' || typeof parsed.status !== 'string') return IDLE;
    return {
      status: parsed.status,
      runningSince: typeof parsed.runningSince === 'number' ? parsed.runningSince : null,
      bankedMs: parsed.bankedMs,
    };
  } catch {
    return IDLE;
  }
}

function writeClock(storageKey: string, state: ClockState) {
  try {
    if (state.status === 'idle') window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Private mode or full storage: the timer still works, it just won't survive a reload.
  }
}

const elapsedOf = (state: ClockState, now: number) =>
  state.bankedMs + (state.runningSince === null ? 0 : now - state.runningSince);

/**
 * Wall-clock based, so a throttled background tab or a reload never makes the
 * workout drift. The state is kept per workout part in localStorage.
 */
export function useWorkoutTimer(
  plan: TimerPlan,
  storageKey: string,
  onCue: (cue: TimerCue) => void,
) {
  const [clock, setClock] = useState<ClockState>(() => readClock(storageKey));
  const [now, setNow] = useState(() => Date.now());
  const snapshot = useMemo(() => timerSnapshot(plan, elapsedOf(clock, now)), [plan, clock, now]);
  const emitCue = useEffectEvent(onCue);

  const update = useCallback(
    (next: (state: ClockState, at: number) => ClockState) => {
      const at = Date.now();
      setNow(at);
      setClock((state) => {
        const updated = next(state, at);
        writeClock(storageKey, updated);
        return updated;
      });
    },
    [storageKey],
  );

  useEffect(() => {
    if (clock.status !== 'running') return;
    let previous = timerSnapshot(plan, elapsedOf(clock, Date.now()));
    const timer = window.setInterval(() => {
      const at = Date.now();
      const next = timerSnapshot(plan, elapsedOf(clock, at));
      const cue = timerCue(previous, next);
      previous = next;
      if (cue) emitCue(cue);
      if (next.phase === 'done') {
        update((state, stoppedAt) => ({
          status: 'finished',
          runningSince: null,
          bankedMs: elapsedOf(state, stoppedAt),
        }));
      } else {
        setNow(at);
      }
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [clock, plan, update]);

  const start = useCallback(
    () =>
      update((state, at) => ({ status: 'running', runningSince: at, bankedMs: state.bankedMs })),
    [update],
  );
  const pause = useCallback(
    () =>
      update((state, at) => ({
        status: 'paused',
        runningSince: null,
        bankedMs: elapsedOf(state, at),
      })),
    [update],
  );
  const finish = useCallback(
    () =>
      update((state, at) => ({
        status: 'finished',
        runningSince: null,
        bankedMs: elapsedOf(state, at),
      })),
    [update],
  );
  const reset = useCallback(() => update(() => IDLE), [update]);

  return { status: clock.status, snapshot, start, pause, finish, reset };
}
