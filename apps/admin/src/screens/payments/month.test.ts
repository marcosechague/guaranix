import { describe, expect, it } from 'vitest';
import { monthInstants } from './month';

describe('monthInstants', () => {
  it('spans the local month in Asunción (UTC-3)', () => {
    const month = monthInstants('2026-11-27', 'America/Asuncion');
    expect(month.from).toBe('2026-11-01T03:00:00.000Z');
    expect(month.to).toBe('2026-12-01T03:00:00.000Z');
    expect(month.name).toBe('noviembre');
  });
});
