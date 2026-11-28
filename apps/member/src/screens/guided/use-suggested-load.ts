import { bestLoadGrams, suggestedLoadGrams } from '@guaranix/shared';
import type { WorkoutComponent } from '@guaranix/shared/api';
import { useMovements, useMyRecords } from '../../api/queries';

export interface LoadSuggestion {
  movementName: string;
  percent: number;
  bestGrams: number;
  suggestedGrams: number;
}

/**
 * The coach's % of the member's best on the part's movement. Records are not
 * kept offline (they're the member's own data), so offline there may be none.
 */
export function useSuggestedLoad(component: WorkoutComponent) {
  const enabled = component.movementId !== null;
  const records = useMyRecords();
  const movements = useMovements();
  const movementName =
    movements.data?.find((movement) => movement.id === component.movementId)?.name ?? null;
  const best =
    enabled && records.data && component.movementId
      ? bestLoadGrams(records.data, component.movementId)
      : null;
  const suggestion: LoadSuggestion | null =
    best !== null && component.loadPercent !== null && movementName
      ? {
          movementName,
          percent: component.loadPercent,
          bestGrams: best,
          suggestedGrams: suggestedLoadGrams(best, component.loadPercent),
        }
      : null;
  return {
    takesLoad: enabled,
    movementName,
    suggestion,
    isPending: enabled && records.isPending && records.fetchStatus === 'fetching',
  };
}
