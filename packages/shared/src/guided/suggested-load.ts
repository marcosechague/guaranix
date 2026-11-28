/** What the suggestion needs from the member's personal records. */
export interface LoadRecord {
  movementId: string;
  repMax: number | null;
  loadGrams: number | null;
}

/** Barbells load in 2.5 kg steps (1.25 kg a side). */
export const LOAD_STEP_GRAMS = 2500;

/**
 * The member's reference load for a movement: a 1RM when they have one,
 * otherwise their heaviest logged load. Null when they never lifted it.
 */
export function bestLoadGrams(records: readonly LoadRecord[], movementId: string): number | null {
  const loads = (repMax: number | null) =>
    records
      .filter((record) => record.movementId === movementId && record.repMax === repMax)
      .flatMap((record) => (record.loadGrams === null ? [] : [record.loadGrams]));
  const oneRepMax = loads(1);
  if (oneRepMax.length > 0) return Math.max(...oneRepMax);
  const best = loads(null);
  return best.length > 0 ? Math.max(...best) : null;
}

/** Rounded down to a loadable weight: suggesting a bit less is the safe side. */
export function suggestedLoadGrams(bestGrams: number, percent: number): number {
  const raw = (bestGrams * percent) / 100;
  return Math.max(LOAD_STEP_GRAMS, Math.floor(raw / LOAD_STEP_GRAMS) * LOAD_STEP_GRAMS);
}

/** The +/- buttons before starting move by one plate step and never go below one. */
export function stepLoadGrams(currentGrams: number, direction: 1 | -1): number {
  return Math.max(LOAD_STEP_GRAMS, currentGrams + direction * LOAD_STEP_GRAMS);
}
