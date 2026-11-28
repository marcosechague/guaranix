import type { QueryKey } from '@tanstack/react-query';
import { catalogKeys } from '@guaranix/ui/data';

/** Query keys in one place so mutations invalidate exactly what they change. */
export const queryKeys = {
  me: ['me'] as const,
  myPlans: ['me', 'plans'] as const,
  myBookings: ['me', 'bookings'] as const,
  myRecords: ['me', 'records'] as const,
  // Money stays off the phone's offline cache: see keepOffline.
  myAccount: ['me', 'account'] as const,
  plans: catalogKeys.plans,
  movements: catalogKeys.movements,
  programs: catalogKeys.programs,
  classes: (from: string, to: string) => ['classes', from, to] as const,
  allClasses: ['classes'] as const,
  workouts: (date: string) => ['workouts', date] as const,
  leaderboard: (componentId: string) => ['leaderboard', componentId] as const,
};

const OFFLINE_ROOTS = new Set(['box', 'programs', 'workouts', 'classes']);

/**
 * What the app keeps on the phone for offline use: the box, today's WOD,
 * classes and own bookings and plans. Never the member profile (medical
 * notes, ID number), records or other members' results.
 */
export function keepOffline(queryKey: QueryKey): boolean {
  const [root, sub] = queryKey;
  if (root === 'me') return sub === 'bookings' || sub === 'plans';
  return typeof root === 'string' && OFFLINE_ROOTS.has(root);
}
