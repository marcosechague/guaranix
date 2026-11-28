import type { GuidedPlan } from '@guaranix/shared';
import { useCallback, useState } from 'react';
import {
  advanceProgress,
  clearProgress,
  type GuidedProgress,
  NO_PROGRESS,
  readProgress,
  undoProgress,
  writeProgress,
} from './guided-progress';

/** The guided progress of one part, saved on every change so a reload picks it up. */
export function useGuidedProgress(storageKey: string, plan: GuidedPlan) {
  const [state, setState] = useState<GuidedProgress>(() => readProgress(storageKey));

  const save = useCallback(
    (next: GuidedProgress) => {
      writeProgress(storageKey, next);
      setState(next);
    },
    [storageKey],
  );

  /** Returns true when the tap finished the WOD. */
  const advance = (atSeconds: number): boolean => {
    const { progress, finished } = advanceProgress(state, plan, atSeconds);
    save(progress);
    return finished;
  };

  const setLoad = useCallback(
    (loadGrams: number) =>
      setState((current) => {
        const next = { ...current, loadGrams };
        writeProgress(storageKey, next);
        return next;
      }),
    [storageKey],
  );

  return {
    state,
    advance,
    setLoad,
    undo: () => save(undoProgress(state, plan)),
    /** Back to the start, keeping the load the member picked. */
    reset: () => {
      clearProgress(storageKey);
      setState({ ...NO_PROGRESS, loadGrams: state.loadGrams });
    },
  };
}
