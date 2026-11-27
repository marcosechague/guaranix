import { describe, expect, it } from 'vitest';
import { missingScoreFields, workoutComponentSchema, workoutResultSchema } from './workout';

const id = '018f3c1e-7d2a-7c3b-9a1e-2b3c4d5e6f70';

describe('workoutComponentSchema', () => {
  it('requires a duration for AMRAPs', () => {
    const amrap = {
      position: 0,
      kind: 'metcon',
      description: 'AMRAP',
      scoreType: 'rounds_reps',
      timerType: 'amrap',
    };
    expect(workoutComponentSchema.safeParse(amrap).success).toBe(false);
    expect(workoutComponentSchema.safeParse({ ...amrap, timeCapSeconds: 720 }).success).toBe(true);
  });

  it('requires interval and rounds for EMOMs', () => {
    const emom = {
      position: 0,
      kind: 'metcon',
      description: 'EMOM',
      timerType: 'emom',
      rounds: 10,
    };
    expect(workoutComponentSchema.safeParse(emom).success).toBe(false);
    expect(workoutComponentSchema.safeParse({ ...emom, intervalSeconds: 60 }).success).toBe(true);
  });
});

describe('missingScoreFields', () => {
  const result = workoutResultSchema.parse({
    componentId: id,
    memberId: id,
    scaling: 'rx',
    rounds: 7,
  });

  it('asks AMRAP results for rounds and reps', () => {
    expect(missingScoreFields('rounds_reps', result)).toEqual(['reps']);
  });

  it('accepts unscored components without values', () => {
    expect(missingScoreFields('none', result)).toEqual([]);
  });
});
