import { t } from '@guaranix/shared';

export const BOOKING_WINDOWS = ['12', '24', '48', '168'] as const;
export type BookingWindow = (typeof BOOKING_WINDOWS)[number];

export const isBookingWindow = (hours: string): hours is BookingWindow =>
  (BOOKING_WINDOWS as readonly string[]).includes(hours);

/** "24 horas", "una semana". */
export function bookingWindowText(hours: number): string {
  const key = String(hours);
  return isBookingWindow(key) ? t(`onboarding.details.bookingWindow.${key}`) : `${hours} h`;
}
