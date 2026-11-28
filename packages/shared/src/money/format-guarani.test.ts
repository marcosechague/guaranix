import { describe, expect, it } from 'vitest';
import { formatGuarani, formatGuaraniCompact } from './format-guarani';

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

describe('formatGuaraniCompact', () => {
  it.each([
    [4_800_000, '₲ 4,8 M'],
    [12_000_000, '₲ 12 M'],
    [1_250_000, '₲ 1,3 M'],
    [596_000, '₲ 596.000'],
  ])('shows %i as %s', (amount, text) => {
    expect(formatGuaraniCompact(amount)).toBe(text);
  });
});
