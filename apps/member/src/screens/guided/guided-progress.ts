import type { GuidedPlan } from '@guaranix/shared';

/** Where the member is in the guided WOD; kept per part so a reload doesn't lose it. */
export interface GuidedProgress {
  /** Next movement to finish, in `plan.sequence` (For time). */
  stepIndex: number;
  /** Rounds tapped (AMRAP). */
  rounds: number;
  /** Workout seconds at each tap, for the splits after the WOD. */
  splits: number[];
  /** The load picked before starting, in grams. */
  loadGrams: number | null;
}

export const NO_PROGRESS: GuidedProgress = { stepIndex: 0, rounds: 0, splits: [], loadGrams: null };

/** A tap on the screen. `finished` means the last movement of a For time is done. */
export function advanceProgress(
  progress: GuidedProgress,
  plan: GuidedPlan,
  atSeconds: number,
): { progress: GuidedProgress; finished: boolean } {
  switch (plan.advance) {
    case 'steps': {
      if (progress.stepIndex >= plan.sequence.length) return { progress, finished: true };
      const stepIndex = progress.stepIndex + 1;
      return {
        progress: { ...progress, stepIndex, splits: [...progress.splits, atSeconds] },
        finished: stepIndex >= plan.sequence.length,
      };
    }
    case 'rounds':
      return {
        progress: {
          ...progress,
          rounds: progress.rounds + 1,
          splits: [...progress.splits, atSeconds],
        },
        finished: false,
      };
    case 'intervals':
      return { progress, finished: false };
  }
}

/** Takes back a mis-tap. */
export function undoProgress(progress: GuidedProgress, plan: GuidedPlan): GuidedProgress {
  const splits = progress.splits.slice(0, -1);
  if (plan.advance === 'steps') {
    return { ...progress, stepIndex: Math.max(0, progress.stepIndex - 1), splits };
  }
  if (plan.advance === 'rounds') {
    return { ...progress, rounds: Math.max(0, progress.rounds - 1), splits };
  }
  return progress;
}

export function readProgress(storageKey: string): GuidedProgress {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return NO_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<GuidedProgress>;
    const count = (value: unknown) =>
      typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
    return {
      stepIndex: count(parsed.stepIndex),
      rounds: count(parsed.rounds),
      splits: Array.isArray(parsed.splits)
        ? parsed.splits.filter((value): value is number => typeof value === 'number')
        : [],
      loadGrams: typeof parsed.loadGrams === 'number' ? parsed.loadGrams : null,
    };
  } catch {
    return NO_PROGRESS;
  }
}

export function writeProgress(storageKey: string, progress: GuidedProgress) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(progress));
  } catch {
    // Private mode or full storage: the guided WOD still works, it just won't survive a reload.
  }
}

export function clearProgress(storageKey: string) {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Nothing to clear.
  }
}
