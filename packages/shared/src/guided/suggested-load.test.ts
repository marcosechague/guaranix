import { describe, expect, it } from 'vitest';
import { bestLoadGrams, stepLoadGrams, suggestedLoadGrams } from './suggested-load';

const thruster = 'thruster';

describe('bestLoadGrams', () => {
  it('prefers a 1RM over the heaviest logged load', () => {
    const records = [
      { movementId: thruster, repMax: null, loadGrams: 45_000 },
      { movementId: thruster, repMax: 1, loadGrams: 40_000 },
      { movementId: thruster, repMax: 3, loadGrams: 50_000 },
    ];
    expect(bestLoadGrams(records, thruster)).toBe(40_000);
  });

  it('uses the heaviest load when there is no 1RM, and ignores other movements', () => {
    const records = [
      { movementId: thruster, repMax: null, loadGrams: 35_000 },
      { movementId: thruster, repMax: null, loadGrams: 42_500 },
      { movementId: 'clean', repMax: 1, loadGrams: 80_000 },
    ];
    expect(bestLoadGrams(records, thruster)).toBe(42_500);
    expect(bestLoadGrams(records, 'snatch')).toBeNull();
  });
});

describe('suggestedLoadGrams', () => {
  it('rounds down to a loadable weight', () => {
    expect(suggestedLoadGrams(40_000, 75)).toBe(30_000);
    expect(suggestedLoadGrams(63_000, 70)).toBe(42_500);
  });

  it('never suggests less than one plate step', () => {
    expect(suggestedLoadGrams(1_000, 50)).toBe(2_500);
  });
});

describe('stepLoadGrams', () => {
  it('moves by 2.5 kg without going below it', () => {
    expect(stepLoadGrams(30_000, 1)).toBe(32_500);
    expect(stepLoadGrams(2_500, -1)).toBe(2_500);
  });
});
