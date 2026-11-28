import type { Workout } from '@guaranix/shared/api';
import { describe, expect, it } from 'vitest';
import { blankComponent, formFieldOf, toFormValues, toWorkoutInput } from './workout-form';

const context = { programId: '018f3c1e-7d2a-7c3b-9a1e-2b3c4d5e6f70', workoutDate: '2026-11-28' };

describe('workout form', () => {
  it('converts minutes to seconds and blanks to null', () => {
    const result = toWorkoutInput(
      {
        title: '  ',
        coachNotes: '',
        components: [
          {
            ...blankComponent(),
            timerType: 'amrap',
            timeCapMinutes: '12',
            description: '10 burpees',
          },
        ],
      },
      context,
    );
    expect(result.success).toBe(true);
    const component = result.data?.components[0];
    expect(result.data?.title).toBeNull();
    expect(component?.timeCapSeconds).toBe(720);
    expect(component?.rounds).toBeNull();
    expect(component?.movementId).toBeNull();
  });

  it('points a missing AMRAP duration at the minutes field', () => {
    const result = toWorkoutInput(
      {
        title: '',
        coachNotes: '',
        components: [{ ...blankComponent(), timerType: 'amrap', description: 'x' }],
      },
      context,
    );
    expect(result.success).toBe(false);
    const fields = result.error?.issues.map((issue) => formFieldOf(issue.path));
    expect(fields).toContain('components.0.timeCapMinutes');
  });

  it('round-trips a saved workout in position order', () => {
    const saved = {
      title: 'Fran',
      coachNotes: null,
      components: [
        {
          position: 1,
          kind: 'metcon',
          title: null,
          description: '21-15-9',
          scoreType: 'time',
          timerType: 'for_time',
          timeCapSeconds: 600,
          rounds: null,
          intervalSeconds: null,
          workSeconds: null,
          restSeconds: null,
          movementId: null,
        },
        {
          position: 0,
          kind: 'warm_up',
          title: null,
          description: 'Row',
          scoreType: 'none',
          timerType: 'none',
          timeCapSeconds: null,
          rounds: null,
          intervalSeconds: null,
          workSeconds: null,
          restSeconds: null,
          movementId: null,
        },
      ],
    } as unknown as Workout;
    const values = toFormValues(saved);
    expect(values.components.map((component) => component.kind)).toEqual(['warm_up', 'metcon']);
    expect(values.components[1]?.timeCapMinutes).toBe('10');
  });

  it('drops blank guided steps and only keeps a load % with its movement', () => {
    const movementId = '018f3c1e-7d2a-7c3b-9a1e-2b3c4d5e6f71';
    const result = toWorkoutInput(
      {
        title: '',
        coachNotes: '',
        components: [
          {
            ...blankComponent(),
            description: '21-15-9 Thrusters',
            guidedSteps: [
              { quantity: ' 21 ', name: ' Thrusters ' },
              { quantity: '', name: '  ' },
            ],
            movementId,
            loadPercent: '75',
          },
          { ...blankComponent(), description: '10 burpees', loadPercent: '60' },
        ],
      },
      context,
    );
    expect(result.success).toBe(true);
    expect(result.data?.components[0]).toMatchObject({
      guidedSteps: [{ quantity: '21', name: 'Thrusters' }],
      loadPercent: 75,
    });
    expect(result.data?.components[1]).toMatchObject({ guidedSteps: null, loadPercent: null });
  });
});
