import { describe, expect, it } from 'vitest';
import { formatGuarani } from './format-guarani';

describe('formatGuarani', () => {
  it.each([
    [0, '₲ 0'],
    [500, '₲ 500'],
    [1000, '₲ 1.000'],
    [300000, '₲ 300.000'],
    [12500000, '₲ 12.500.000'],
    [-45000, '-₲ 45.000'],
  ])('formats %i as %s', (amount, expected) => {
    expect(formatGuarani(amount)).toBe(expected);
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 2])(
    'rejects %d',
    (amount) => {
      expect(() => formatGuarani(amount)).toThrow(RangeError);
    },
  );
});
