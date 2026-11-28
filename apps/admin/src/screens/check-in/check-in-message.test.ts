import { describe, expect, it } from 'vitest';
import { CHECK_IN_DENIALS } from '@guaranix/shared';
import { checkInMessage } from './check-in-message';

const member = { id: 'm1', firstName: 'Lucía', lastName: 'Benítez' };
// 07:00 in Asunción.
const crossfit = { id: 'c1', programName: 'CrossFit', startsAt: '2026-11-30T10:00:00Z' };
const zone = 'America/Asuncion';

describe('checkInMessage', () => {
  it('welcomes a booked member with the class', () => {
    expect(
      checkInMessage({ outcome: 'checked_in', member, class: crossfit, walkIn: false }, zone),
    ).toEqual({ tone: 'success', title: '¡Adelante, Lucía!', detail: 'CrossFit · 07:00' });
  });

  it('says when the spot was taken at the door', () => {
    const message = checkInMessage(
      { outcome: 'checked_in', member, class: crossfit, walkIn: true },
      zone,
    );
    expect(message.detail).toContain('CrossFit · 07:00');
    expect(message.detail).not.toBe('CrossFit · 07:00');
  });

  it('shows the overdue amount in guaraníes', () => {
    const message = checkInMessage(
      { outcome: 'denied', reason: 'fee_overdue', member, class: null, owedGs: 250_000 },
      zone,
    );
    expect(message.tone).toBe('warning');
    expect(message.detail).toContain('₲ 250.000');
  });

  it('greets staff and shows when they arrived', () => {
    const message = checkInMessage(
      { outcome: 'staff_arrived', member, arrivedAt: '2026-11-28T10:05:00Z' },
      zone,
    );
    expect(message.tone).toBe('success');
    expect(message.title).toContain(member.firstName);
    expect(message.detail).toContain('07:05');
  });

  it('has a message for every denial', () => {
    for (const reason of CHECK_IN_DENIALS) {
      const { detail } = checkInMessage(
        { outcome: 'denied', reason, member, class: crossfit, owedGs: 1000 },
        zone,
      );
      expect(detail).not.toMatch(/admin\.checkIn/);
    }
  });
});
