import { describe, expect, it } from 'vitest';
import { PARAGUAY_DEPARTMENTS, isParaguayCity } from './paraguay-cities';

describe('PARAGUAY_DEPARTMENTS', () => {
  it('has the capital and the 17 departments', () => {
    expect(PARAGUAY_DEPARTMENTS).toHaveLength(18);
  });

  it('never repeats a city inside a department', () => {
    for (const department of PARAGUAY_DEPARTMENTS) {
      expect(new Set(department.cities).size).toBe(department.cities.length);
    }
  });

  it('recognizes listed cities only', () => {
    expect(isParaguayCity('Encarnación')).toBe(true);
    expect(isParaguayCity('Buenos Aires')).toBe(false);
  });
});
