import { describe, expect, it } from 'vitest';
import type { BoxFeatureState } from '../schemas/features';
import {
  boxFeatureChanged,
  boxFeatureDraft,
  boxFeatureInput,
  featureChanges,
  parseMonthlyLimit,
  planFeatureChanged,
  planFeatureInput,
} from './feature-drafts';

const state = (overrides: Partial<BoxFeatureState> = {}): BoxFeatureState => ({
  feature: 'whatsapp',
  plan: { enabled: true, monthlyLimit: 200 },
  override: null,
  effective: { enabled: true, monthlyLimit: 200 },
  usedThisMonth: 0,
  ...overrides,
});

describe('parseMonthlyLimit', () => {
  it('reads empty as no limit and rejects anything but a whole number in range', () => {
    expect(parseMonthlyLimit('  ')).toBeNull();
    expect(parseMonthlyLimit('0')).toBe(0);
    expect(parseMonthlyLimit(' 50 ')).toBe(50);
    expect(parseMonthlyLimit('-1')).toBe('invalid');
    expect(parseMonthlyLimit('1.5')).toBe('invalid');
    expect(parseMonthlyLimit('100001')).toBe('invalid');
  });
});

describe('box feature drafts', () => {
  it('starts from the saved override', () => {
    expect(boxFeatureDraft(state())).toEqual({ mode: 'plan', limit: '' });
    expect(boxFeatureDraft(state({ override: { enabled: true, monthlyLimit: 30 } }))).toEqual({
      mode: 'on',
      limit: '30',
    });
    expect(boxFeatureDraft(state({ override: { enabled: false, monthlyLimit: null } }))).toEqual({
      mode: 'off',
      limit: '',
    });
  });

  it('saves null to follow the plan, and drops the limit when the box would not have it', () => {
    const plan = { enabled: true, monthlyLimit: 200 };
    expect(boxFeatureInput({ mode: 'plan', limit: '' }, plan)).toEqual({
      enabled: null,
      monthlyLimit: null,
    });
    expect(boxFeatureInput({ mode: 'plan', limit: '500' }, plan)).toEqual({
      enabled: null,
      monthlyLimit: 500,
    });
    expect(boxFeatureInput({ mode: 'off', limit: '500' }, plan)).toEqual({
      enabled: false,
      monthlyLimit: null,
    });
    expect(
      boxFeatureInput({ mode: 'plan', limit: '500' }, { enabled: false, monthlyLimit: null }),
    ).toEqual({ enabled: null, monthlyLimit: null });
    expect(boxFeatureInput({ mode: 'on', limit: 'x' }, plan)).toBe('invalid');
  });

  it('only counts a limit change while the feature is on', () => {
    const saved = state();
    expect(boxFeatureChanged({ mode: 'plan', limit: '' }, saved)).toBe(false);
    expect(boxFeatureChanged({ mode: 'plan', limit: '10' }, saved)).toBe(true);
    expect(boxFeatureChanged({ mode: 'on', limit: '' }, saved)).toBe(true);
    const off = state({ plan: { enabled: false, monthlyLimit: null } });
    expect(boxFeatureChanged({ mode: 'plan', limit: '10' }, off)).toBe(false);
  });
});

describe('plan feature drafts', () => {
  const saved = { feature: 'brodi' as const, enabled: true, monthlyLimit: 100 };

  it('saves the limit only for an included feature', () => {
    expect(planFeatureInput({ enabled: true, limit: '' })).toEqual({
      enabled: true,
      monthlyLimit: null,
    });
    expect(planFeatureInput({ enabled: false, limit: '9' })).toEqual({
      enabled: false,
      monthlyLimit: null,
    });
    expect(planFeatureInput({ enabled: true, limit: 'abc' })).toBe('invalid');
  });

  it('notices what changed', () => {
    expect(planFeatureChanged({ enabled: true, limit: '100' }, saved)).toBe(false);
    expect(planFeatureChanged({ enabled: true, limit: '120' }, saved)).toBe(true);
    expect(planFeatureChanged({ enabled: false, limit: '100' }, saved)).toBe(true);
  });
});

describe('featureChanges', () => {
  it('keeps the valid rows to save and names the wrong ones', () => {
    expect(
      featureChanges([
        { feature: 'whatsapp', input: { enabled: true, monthlyLimit: 5 } },
        { feature: 'brodi', input: 'invalid' as const },
      ]),
    ).toEqual({
      invalid: new Set(['brodi']),
      changes: [{ feature: 'whatsapp', enabled: true, monthlyLimit: 5 }],
    });
  });
});
