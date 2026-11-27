import { describe, expect, it } from 'vitest';
import {
  addDays,
  calendarDateIn,
  daysBetween,
  inclusiveDayCount,
  rangesOverlap,
  weekdayOf,
} from './calendar-date';

describe('calendar dates', () => {
  it('adds days across months and leap years', () => {
    expect(addDays('2026-11-27', 5)).toBe('2026-12-02');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-11-01', '2026-11-30')).toBe(29);
    expect(daysBetween('2026-11-30', '2026-11-01')).toBe(-29);
    expect(inclusiveDayCount('2026-11-23', '2026-11-29')).toBe(7);
  });

  it('knows the weekday', () => {
    expect(weekdayOf('2026-11-27')).toBe(5);
    expect(weekdayOf('2026-11-29')).toBe(0);
  });

  it('reads the local date in Asunción, not UTC', () => {
    // 01:30 UTC on the 28th is still 22:30 on the 27th in Asunción (UTC-3).
    expect(calendarDateIn('America/Asuncion', new Date('2026-11-28T01:30:00Z'))).toBe('2026-11-27');
  });

  it('detects overlapping ranges, edges included', () => {
    const november = { startsOn: '2026-11-01', endsOn: '2026-11-30' };
    expect(rangesOverlap(november, { startsOn: '2026-11-30', endsOn: '2026-12-29' })).toBe(true);
    expect(rangesOverlap(november, { startsOn: '2026-12-01', endsOn: '2026-12-30' })).toBe(false);
  });
});
