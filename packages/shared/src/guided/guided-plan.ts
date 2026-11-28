import type { GuidedStep } from '../schemas/workout';
import type { TimerPlan } from '../timer/workout-timer';
import { guidedStepsFor, type GuidedSource } from './guided-steps';

/**
 * How a tap moves the workout forward:
 * - `steps`: For time, each tap marks the current movement done and shows the next.
 * - `rounds`: AMRAP, each tap adds a round.
 * - `intervals`: EMOM and Tabata, the clock moves to the next movement on its own.
 */
export type GuidedAdvance = 'steps' | 'rounds' | 'intervals';

export interface GuidedPlan {
  advance: GuidedAdvance;
  /** One round of movements. */
  steps: GuidedStep[];
  /** Everything to tap through in For time: `steps` repeated once per round. */
  sequence: GuidedStep[];
  rounds: number;
}

export interface GuidedPlanSource extends GuidedSource {
  rounds: number | null;
}

const ROUND_COUNT = /(\d+)\s*(?:rondas?|rounds?|rft)\b/i;
const MAX_SEQUENCE = 200;

/** "5 rondas" / "3 rounds for time" in the description, when the coach left `rounds` empty. */
export function roundsFromDescription(description: string): number | null {
  const match = ROUND_COUNT.exec(description);
  const rounds = match?.[1] ? Number(match[1]) : null;
  return rounds !== null && rounds >= 1 && rounds <= 50 ? rounds : null;
}

const ADVANCE: Record<TimerPlan['type'], GuidedAdvance> = {
  for_time: 'steps',
  amrap: 'rounds',
  emom: 'intervals',
  tabata: 'intervals',
};

/** Null when the part can't be guided: no timer, or no movements to show. */
export function guidedPlanFor(
  source: GuidedPlanSource,
  timer: TimerPlan | null,
): GuidedPlan | null {
  if (!timer) return null;
  const steps = guidedStepsFor(source);
  if (steps.length === 0) return null;
  const advance = ADVANCE[timer.type];
  if (advance !== 'steps') return { advance, steps, sequence: steps, rounds: 1 };
  const rounds = source.rounds ?? roundsFromDescription(source.description) ?? 1;
  const repeat = Math.max(1, Math.min(rounds, Math.floor(MAX_SEQUENCE / steps.length)));
  const sequence = Array.from({ length: repeat }, () => steps).flat();
  return { advance, steps, sequence, rounds: repeat };
}

/** The movement on screen for EMOM and Tabata: one per interval, cycling. */
export function intervalStep(plan: GuidedPlan, round: number): GuidedStep | null {
  if (plan.steps.length === 0) return null;
  const index = (Math.max(1, round) - 1) % plan.steps.length;
  return plan.steps[index] ?? null;
}
