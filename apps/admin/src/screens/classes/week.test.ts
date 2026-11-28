import type { ClassListItem } from '@guaranix/shared/api';
import { describe, expect, it } from 'vitest';
import { groupByDay, shiftWeek, weekDays } from './week';

const item = (id: string, startsAt: string) => ({ id, startsAt }) as ClassListItem;

describe('week helpers', () => {
  it('lists the seven days from the start of the week', () => {
    const days = weekDays('2026-11-23');
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-11-23');
    expect(days[6]).toBe('2026-11-29');
  });

  it('moves whole weeks and lands on a week start', () => {
    expect(shiftWeek('2026-11-23', 1)).toBe('2026-11-30');
    expect(shiftWeek('2026-11-23', -1)).toBe('2026-11-16');
  });

  it('groups by the local day, not the UTC day', () => {
    // 22:30 in Asunción (UTC-3) is already the next day in UTC.
    const late = item('late', '2026-11-25T01:30:00.000Z');
    const early = item('early', '2026-11-24T09:00:00.000Z');
    const grouped = groupByDay([late, early], 'America/Asuncion');
    expect(grouped.get('2026-11-24')?.map((entry) => entry.id)).toEqual(['early', 'late']);
  });
});
