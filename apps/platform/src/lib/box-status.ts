import { type BoxStatus, type PlatformBoxSummary, t } from '@guaranix/shared';
import type { BadgeTone } from '@guaranix/ui';

const DAY_MS = 24 * 60 * 60 * 1000;

export const STATUS_TONES: Record<BoxStatus, BadgeTone> = {
  trial: 'accent',
  active: 'success',
  suspended: 'warning',
  cancelled: 'neutral',
};

export const statusLabel = (status: BoxStatus) => t(`platform.status.${status}`);

/** "Prueba: 12 días" while a trial runs; null for boxes that are not in trial. */
export function trialLabel(box: Pick<PlatformBoxSummary, 'status' | 'trialEndsAt'>, now: Date) {
  if (box.status !== 'trial' || !box.trialEndsAt) return null;
  const days = Math.ceil((Date.parse(box.trialEndsAt) - now.getTime()) / DAY_MS);
  if (days < 0) return t('platform.boxes.trialOver');
  if (days === 0) return t('platform.boxes.trialToday');
  return t('platform.boxes.trialLeft', { days });
}

const dateFormat = new Intl.DateTimeFormat('es-PY', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Asuncion',
});

export const formatInstantDate = (instant: string) => dateFormat.format(new Date(instant));

/** For `<input type="date">`, in Asunción. */
export function dateInputValue(instant: string | null): string {
  if (!instant) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion' }).format(
    new Date(instant),
  );
}
