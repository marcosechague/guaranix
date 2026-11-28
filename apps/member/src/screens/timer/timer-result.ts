import { formatDuration } from '@guaranix/shared';
import type { ScoreText } from '../wod/score-form';

/** What the timer hands to the WOD screen so the result form opens already filled. */
export interface TimerResult {
  componentId: string;
  score: Partial<ScoreText>;
}

export function timerResultState(
  componentId: string,
  { timeSeconds, rounds }: { timeSeconds?: number; rounds?: number },
): { timerResult: TimerResult } {
  const score: Partial<ScoreText> = {};
  if (timeSeconds !== undefined) score.time = formatDuration(timeSeconds);
  if (rounds !== undefined) score.rounds = String(rounds);
  return { timerResult: { componentId, score } };
}

/** Reads it back from router state, which anything could have written. */
export function readTimerResult(state: unknown): TimerResult | null {
  if (typeof state !== 'object' || state === null || !('timerResult' in state)) return null;
  const result = (state as { timerResult: unknown }).timerResult;
  if (typeof result !== 'object' || result === null) return null;
  const { componentId, score } = result as { componentId?: unknown; score?: unknown };
  if (typeof componentId !== 'string' || typeof score !== 'object' || score === null) return null;
  const fields = score as Record<string, unknown>;
  const text = (key: keyof ScoreText) =>
    typeof fields[key] === 'string' ? { [key]: fields[key] as string } : {};
  return { componentId, score: { ...text('time'), ...text('rounds') } };
}
