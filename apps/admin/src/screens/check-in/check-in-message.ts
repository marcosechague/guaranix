import { formatGuarani, formatTimeIn, t, type CheckInResult } from '@guaranix/shared';

export interface CheckInMessage {
  tone: 'success' | 'warning';
  title: string;
  detail: string;
}

/** What the entrance screen says, big enough to read from a step away. */
export function checkInMessage(result: CheckInResult, timeZone: string): CheckInMessage {
  const name = result.member.firstName;
  const classLine = result.class
    ? t('admin.checkIn.classLine', {
        program: result.class.programName,
        time: formatTimeIn(timeZone, result.class.startsAt),
      })
    : '';
  if (result.outcome === 'already_checked_in') {
    return { tone: 'success', title: t('admin.checkIn.already', { name }), detail: classLine };
  }
  if (result.outcome !== 'denied') {
    return {
      tone: 'success',
      title: t('admin.checkIn.welcome', { name }),
      detail: result.walkIn ? t('admin.checkIn.walkIn', { class: classLine }) : classLine,
    };
  }
  const amount = result.owedGs === null ? '' : formatGuarani(result.owedGs);
  return {
    tone: 'warning',
    title: t('admin.checkIn.denied', { name }),
    detail: t(`admin.checkIn.reasons.${result.reason}`, { amount, class: classLine }),
  };
}
