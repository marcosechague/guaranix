import { describe, expect, it } from 'vitest';
import { classScheduleSchema } from './schedule';

const programId = '018f3c1e-7d2a-7c3b-9a1e-2b3c4d5e6f70';
const slot = {
  programId,
  weekday: 1,
  startTime: '18:00',
  durationMinutes: 60,
  capacity: 16,
  validFrom: '2026-12-01',
};

describe('classScheduleSchema', () => {
  it('accepts a typical evening slot', () => {
    expect(classScheduleSchema.safeParse(slot).success).toBe(true);
  });

  it.each([
    ['an impossible time', { startTime: '25:00' }],
    ['a class past midnight', { startTime: '23:30', durationMinutes: 60 }],
    ['zero capacity', { capacity: 0 }],
    ['an invalid weekday', { weekday: 7 }],
    ['an end before the start', { validUntil: '2026-11-01' }],
  ])('rejects %s', (_label, override) => {
    expect(classScheduleSchema.safeParse({ ...slot, ...override }).success).toBe(false);
  });
});
