import { describe, expect, it } from 'vitest';
import { fittingFontSize } from './result-card';

describe('fittingFontSize', () => {
  const measure = (characters: number) => (size: number) => characters * size * 0.6;

  it('keeps the largest size when the text fits', () => {
    expect(fittingFontSize(measure(4), 888, 300)).toBe(300);
  });

  it('shrinks long text until it fits, but not below the minimum', () => {
    const size = fittingFontSize(measure(20), 888, 300);
    expect(20 * size * 0.6).toBeLessThanOrEqual(888);
    expect(fittingFontSize(measure(200), 888, 300)).toBe(48);
  });
});
