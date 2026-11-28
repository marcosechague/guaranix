const BOX_TIME_ZONE = 'America/Asuncion';

/** `YYYY-MM-DD` in the box's time zone, `days` from today. */
export function boxDate(days: number): string {
  const instant = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: BOX_TIME_ZONE }).format(instant);
}

/** `HH:MM` as the apps show a class time. */
export function boxTime(isoInstant: string): string {
  return new Intl.DateTimeFormat('es-PY', {
    timeZone: BOX_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(isoInstant));
}
