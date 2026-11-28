import { catalogKeys } from '@guaranix/ui/data';

/** Query keys in one place so mutations invalidate exactly what they change. */
export const queryKeys = {
  me: ['me'] as const,
  myPlans: ['me', 'plans'] as const,
  myBookings: ['me', 'bookings'] as const,
  myRecords: ['me', 'records'] as const,
  plans: catalogKeys.plans,
  movements: catalogKeys.movements,
  programs: catalogKeys.programs,
  classes: (from: string, to: string) => ['classes', from, to] as const,
  allClasses: ['classes'] as const,
  workouts: (date: string) => ['workouts', date] as const,
  leaderboard: (componentId: string) => ['leaderboard', componentId] as const,
};
