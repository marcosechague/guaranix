import type { TimerType } from '../domain';

/** The timer a workout part needs, already resolved from what the coach loaded. */
export type TimerPlan =
  | { type: 'for_time'; capSeconds: number | null }
  | { type: 'amrap'; durationSeconds: number }
  | { type: 'emom'; rounds: number; intervalSeconds: number }
  | { type: 'tabata'; rounds: number; workSeconds: number; restSeconds: number };

export interface TimerSource {
  timerType: TimerType;
  timeCapSeconds: number | null;
  rounds: number | null;
  intervalSeconds: number | null;
  workSeconds: number | null;
  restSeconds: number | null;
}

/** "3, 2, 1" plus time to put the phone down and grab the bar. */
export const COUNTDOWN_SECONDS = 10;

const DEFAULT_TABATA = { rounds: 8, workSeconds: 20, restSeconds: 10 };
const DEFAULT_EMOM_INTERVAL = 60;
const DEFAULT_EMOM_ROUNDS = 10;

const positive = (value: number | null): number | null =>
  value !== null && value > 0 ? Math.floor(value) : null;

/** Null when the part has no timer or an AMRAP without its duration. */
export function timerPlanFor(source: TimerSource): TimerPlan | null {
  switch (source.timerType) {
    case 'for_time':
      return { type: 'for_time', capSeconds: positive(source.timeCapSeconds) };
    case 'amrap': {
      const durationSeconds = positive(source.timeCapSeconds);
      return durationSeconds ? { type: 'amrap', durationSeconds } : null;
    }
    case 'emom': {
      const intervalSeconds = positive(source.intervalSeconds) ?? DEFAULT_EMOM_INTERVAL;
      const cap = positive(source.timeCapSeconds);
      const rounds =
        positive(source.rounds) ??
        (cap ? Math.max(1, Math.floor(cap / intervalSeconds)) : DEFAULT_EMOM_ROUNDS);
      return { type: 'emom', rounds, intervalSeconds };
    }
    case 'tabata':
      return {
        type: 'tabata',
        rounds: positive(source.rounds) ?? DEFAULT_TABATA.rounds,
        workSeconds: positive(source.workSeconds) ?? DEFAULT_TABATA.workSeconds,
        restSeconds: positive(source.restSeconds) ?? DEFAULT_TABATA.restSeconds,
      };
    case 'none':
      return null;
  }
}

export type TimerPhase = 'countdown' | 'work' | 'rest' | 'done';

interface Segment {
  phase: 'work' | 'rest';
  round: number;
  seconds: number;
}

function segmentsOf(plan: TimerPlan): Segment[] {
  switch (plan.type) {
    case 'for_time':
      return [{ phase: 'work', round: 1, seconds: plan.capSeconds ?? Number.POSITIVE_INFINITY }];
    case 'amrap':
      return [{ phase: 'work', round: 1, seconds: plan.durationSeconds }];
    case 'emom':
      return Array.from({ length: plan.rounds }, (_, index) => ({
        phase: 'work' as const,
        round: index + 1,
        seconds: plan.intervalSeconds,
      }));
    case 'tabata':
      // No rest after the last round: the workout ends when the work does.
      return Array.from({ length: plan.rounds }, (_, index) => [
        { phase: 'work' as const, round: index + 1, seconds: plan.workSeconds },
        ...(index < plan.rounds - 1
          ? [{ phase: 'rest' as const, round: index + 1, seconds: plan.restSeconds }]
          : []),
      ]).flat();
  }
}

/** Total length of the workout in seconds; null for a For time with no cap. */
export function timerTotalSeconds(plan: TimerPlan): number | null {
  const total = segmentsOf(plan).reduce((sum, segment) => sum + segment.seconds, 0);
  return Number.isFinite(total) ? total : null;
}

export function timerRounds(plan: TimerPlan): number | null {
  return plan.type === 'emom' || plan.type === 'tabata' ? plan.rounds : null;
}

export interface TimerSnapshot {
  phase: TimerPhase;
  /** -1 during the countdown; one past the last segment when done. */
  segmentIndex: number;
  /** What the big clock shows: counts up for For time, down for everything else. */
  clockSeconds: number;
  /** Whole seconds left in the current phase; null when it has no end. */
  phaseRemainingSeconds: number | null;
  round: number;
  totalRounds: number | null;
  /** Workout time since "go", without the countdown. */
  workoutSeconds: number;
  /** 0 to 1 through the whole workout; null for a For time with no cap. */
  progress: number | null;
}

/** Where the workout is after `elapsedMs` of running time, countdown included. */
export function timerSnapshot(plan: TimerPlan, elapsedMs: number): TimerSnapshot {
  const segments = segmentsOf(plan);
  const total = timerTotalSeconds(plan);
  const totalRounds = timerRounds(plan);
  const workoutMs = Math.max(0, elapsedMs) - COUNTDOWN_SECONDS * 1000;

  if (workoutMs < 0) {
    const remaining = Math.ceil(-workoutMs / 1000);
    return {
      phase: 'countdown',
      segmentIndex: -1,
      clockSeconds: remaining,
      phaseRemainingSeconds: remaining,
      round: 1,
      totalRounds,
      workoutSeconds: 0,
      progress: total === null ? null : 0,
    };
  }

  const workoutSeconds = Math.floor(workoutMs / 1000);
  let segmentStartMs = 0;
  for (const [index, segment] of segments.entries()) {
    const segmentEndMs = segmentStartMs + segment.seconds * 1000;
    if (workoutMs < segmentEndMs) {
      const remaining = Number.isFinite(segmentEndMs)
        ? Math.ceil((segmentEndMs - workoutMs) / 1000)
        : null;
      return {
        phase: segment.phase,
        segmentIndex: index,
        clockSeconds: plan.type === 'for_time' ? workoutSeconds : (remaining ?? 0),
        phaseRemainingSeconds: remaining,
        round: segment.round,
        totalRounds,
        workoutSeconds,
        progress: total === null ? null : Math.min(workoutMs / (total * 1000), 1),
      };
    }
    segmentStartMs = segmentEndMs;
  }

  return {
    phase: 'done',
    segmentIndex: segments.length,
    clockSeconds: plan.type === 'for_time' ? (total ?? workoutSeconds) : 0,
    phaseRemainingSeconds: 0,
    round: totalRounds ?? 1,
    totalRounds,
    workoutSeconds: total ?? workoutSeconds,
    progress: 1,
  };
}

/** Sound and vibration moments: the last three seconds, a new phase, the end. */
export type TimerCue = 'tick' | 'work' | 'rest' | 'done';

const TICK_SECONDS = new Set([1, 2, 3]);

export function timerCue(previous: TimerSnapshot, next: TimerSnapshot): TimerCue | null {
  if (next.phase === 'done') return previous.phase === 'done' ? null : 'done';
  if (next.segmentIndex !== previous.segmentIndex) return next.phase === 'rest' ? 'rest' : 'work';
  if (
    next.phaseRemainingSeconds !== null &&
    next.phaseRemainingSeconds !== previous.phaseRemainingSeconds &&
    TICK_SECONDS.has(next.phaseRemainingSeconds)
  ) {
    return 'tick';
  }
  return null;
}
