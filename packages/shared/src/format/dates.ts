import { addDays, calendarDateIn, weekdayOf } from '../dates/calendar-date';
import { t } from '../i18n';

type Weekday = '0' | '1' | '2' | '3' | '4' | '5' | '6';
type Month = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12';

/** Wall-clock time of an instant in the box's time zone, e.g. `19:00`. */
export function formatTimeIn(timeZone: string, instant: string | Date): string {
  return new Intl.DateTimeFormat('es-PY', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(instant));
}

export function dateOfInstant(timeZone: string, instant: string | Date): string {
  return calendarDateIn(timeZone, new Date(instant));
}

export function weekdayShort(date: string): string {
  return t(`common.weekdaysShort.${String(weekdayOf(date)) as Weekday}`);
}

/** Name of a weekday number (0 = domingo), as weekly schedules store it. */
export function weekdayName(weekday: number): string {
  return t(`common.weekdaysLong.${String(weekday) as Weekday}`);
}

export function weekdayLong(date: string): string {
  return t(`common.weekdaysLong.${String(weekdayOf(date)) as Weekday}`);
}

export function dayOfMonth(date: string): number {
  return Number(date.slice(8, 10));
}

/** `27 de noviembre` */
export function formatDayMonth(date: string): string {
  const month = String(Number(date.slice(5, 7))) as Month;
  return `${dayOfMonth(date)} de ${t(`common.months.${month}`)}`;
}

/** `27/11` */
export function formatShortDate(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

/** `Hoy`, `Mañana` or `Vie 28`. */
export function relativeDayLabel(date: string, today: string): string {
  if (date === today) return t('common.today');
  if (date === addDays(today, 1)) return t('common.tomorrow');
  return `${weekdayShort(date)} ${dayOfMonth(date)}`;
}
