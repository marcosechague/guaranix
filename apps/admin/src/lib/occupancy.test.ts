import { describe, expect, it } from 'vitest';
import { monthRange, occupancyPercent } from './occupancy';

describe('occupancy helpers', () => {
  it('caps each class at its capacity', () => {
    expect(
      occupancyPercent([
        { takenSpots: 18, capacity: 16 },
        { takenSpots: 4, capacity: 16 },
      ]),
    ).toBe(63);
    expect(occupancyPercent([])).toBe(0);
  });

  it('spans the whole month', () => {
    expect(monthRange('2026-11-27')).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
      name: 'noviembre',
    });
    expect(monthRange('2027-02-10').to).toBe('2027-02-28');
  });
});
