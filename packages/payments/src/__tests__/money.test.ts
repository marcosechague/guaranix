import { describe, expect, it } from 'vitest';
import { formatProviderAmount, parseProviderAmount } from '../money';

describe('provider amounts', () => {
  it('sends whole guaraníes with two zero decimals', () => {
    expect(formatProviderAmount(300_000)).toBe('300000.00');
  });

  it('refuses anything that is not a positive whole amount', () => {
    for (const amount of [0, -1, 10.5, Number.NaN]) {
      expect(() => formatProviderAmount(amount)).toThrow(RangeError);
    }
  });

  it('reads amounts back, and rejects real cents', () => {
    expect(parseProviderAmount('300000.00')).toBe(300_000);
    expect(parseProviderAmount('300000')).toBe(300_000);
    expect(parseProviderAmount(150000)).toBe(150_000);
    expect(parseProviderAmount('300000.50')).toBeNull();
    expect(parseProviderAmount('abc')).toBeNull();
    expect(parseProviderAmount(undefined)).toBeNull();
  });
});
