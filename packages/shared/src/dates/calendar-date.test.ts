import { describe, expect, it } from 'vitest';
import {
  addDays,
  calendarDateIn,
  daysBetween,
  inclusiveDayCount,
  rangesOverlap,
  startOfWeek,
  weekdayOf,
  zonedInstant,
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

  it('turns box-local wall-clock times into instants', () => {
    expect(zonedInstant('2026-11-27', '06:00', 'America/Asuncion').toISOString()).toBe(
      '2026-11-27T09:00:00.000Z',
    );
    expect(zonedInstant('2026-11-27', '20:00', 'UTC').toISOString()).toBe(
      '2026-11-27T20:00:00.000Z',
    );
    // Across a DST change (São Paulo had DST until 2019).
    expect(zonedInstant('2019-01-15', '07:00', 'America/Sao_Paulo').toISOString()).toBe(
      '2019-01-15T09:00:00.000Z',
    );
  });

  it('starts weeks on Monday', () => {
    expect(startOfWeek('2026-11-27')).toBe('2026-11-23');
    expect(startOfWeek('2026-11-23')).toBe('2026-11-23');
    expect(startOfWeek('2026-11-29')).toBe('2026-11-23');
  });
});
