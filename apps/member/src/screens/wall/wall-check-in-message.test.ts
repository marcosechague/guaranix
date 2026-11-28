import { CHECK_IN_DENIALS } from '@guaranix/shared';
import { describe, expect, it } from 'vitest';
import { wallCheckInMessage } from './wall-check-in-message';

const member = { id: 'm1', firstName: 'Lucía', lastName: 'Benítez' };
// 07:00 in Asunción.
const crossfit = { id: 'c1', programName: 'CrossFit', startsAt: '2026-11-30T10:00:00Z' };
const zone = 'America/Asuncion';

describe('wallCheckInMessage', () => {
  it('confirms with the class, and says when they were added to it', () => {
    const done = wallCheckInMessage(
      { outcome: 'checked_in', member, class: crossfit, walkIn: true },
      zone,
    );
    expect(done.tone).toBe('success');
    expect(done.title).toContain('Lucía');
    expect(done.detail).toContain('CrossFit · 07:00');
  });

  it('explains every denial in words', () => {
    for (const reason of CHECK_IN_DENIALS) {
      const message = wallCheckInMessage(
        { outcome: 'denied', reason, member, class: crossfit, owedGs: 1000 },
        zone,
      );
      expect(message.tone).toBe('warning');
      expect(message.detail).not.toMatch(/admin\.checkIn|member\.wallCheckIn/);
    }
  });
});
