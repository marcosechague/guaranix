import {
  classScheduleSchema,
  createPlanSchema,
  createProgramSchema,
  movementSchema,
} from '@guaranix/shared/schemas';
import { describe, expect, it } from 'vitest';
import { PARAGUAYAN_BOX_TEMPLATE } from '../templates/paraguayan-box';

const anyId = '018f3c1e-7d2a-7c3b-9a1e-2b3c4d5e6f70';

describe('Paraguayan box template', () => {
  it('passes the same validation as data entered by a box', () => {
    for (const program of Object.values(PARAGUAYAN_BOX_TEMPLATE.programs)) {
      createProgramSchema.parse(program);
    }
    // Zod strips the template-only `program`/`programs` keys.
    for (const schedule of PARAGUAYAN_BOX_TEMPLATE.schedules) {
      classScheduleSchema.parse({ ...schedule, programId: anyId, validFrom: '2026-12-01' });
    }
    for (const plan of PARAGUAYAN_BOX_TEMPLATE.plans) {
      createPlanSchema.parse(plan);
    }
    PARAGUAYAN_BOX_TEMPLATE.movements.forEach((movement) => movementSchema.parse(movement));
  });

  it('offers the usual 6/7/8 and 18/19/20 weekday slots', () => {
    const mondayCrossfit = PARAGUAYAN_BOX_TEMPLATE.schedules
      .filter((slot) => slot.program === 'crossfit' && slot.weekday === 1)
      .map((slot) => slot.startTime);
    expect(mondayCrossfit).toEqual(['06:00', '07:00', '08:00', '18:00', '19:00', '20:00']);
  });

  it('prices everything in whole guaraníes', () => {
    for (const plan of PARAGUAYAN_BOX_TEMPLATE.plans) {
      expect(Number.isInteger(plan.priceGs)).toBe(true);
    }
  });
});
