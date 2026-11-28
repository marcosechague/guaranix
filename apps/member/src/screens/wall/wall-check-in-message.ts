import { formatGuarani, formatTimeIn, t, type CheckInResult } from '@guaranix/shared';
import type { StatusTone } from '@guaranix/ui';

export interface WallMessage {
  tone: StatusTone;
  title: string;
  detail: string;
}

/** What the member reads on their phone after scanning the poster. */
export function wallCheckInMessage(result: CheckInResult, timeZone: string): WallMessage {
  const classLine = result.class
    ? t('member.wallCheckIn.classLine', {
        program: result.class.programName,
        time: formatTimeIn(timeZone, result.class.startsAt),
      })
    : '';
  if (result.outcome === 'already_checked_in') {
    return { tone: 'success', title: t('member.wallCheckIn.already'), detail: classLine };
  }
  if (result.outcome !== 'denied') {
    return {
      tone: 'success',
      title: t('member.wallCheckIn.done', { name: result.member.firstName }),
      detail: result.walkIn ? t('member.wallCheckIn.walkIn', { class: classLine }) : classLine,
    };
  }
  const amount = result.owedGs === null ? '' : formatGuarani(result.owedGs);
  return {
    tone: 'warning',
    title: t('member.wallCheckIn.denied'),
    // The entrance's reasons already speak to the member.
    detail: t(`admin.checkIn.reasons.${result.reason}`, { amount, class: classLine }),
  };
}
