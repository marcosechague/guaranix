import { catalogKeys } from '@guaranix/ui/data';

export const queryKeys = {
  memberCount: ['members', 'count'] as const,
  members: (search: string, status: string) => ['members', 'list', search, status] as const,
  allMembers: ['members'] as const,
  member: (memberId: string) => ['members', 'detail', memberId] as const,
  memberPlans: (memberId: string) => ['members', 'plans', memberId] as const,
  memberRecords: (memberId: string) => ['members', 'records', memberId] as const,
  plans: catalogKeys.plans,
  programs: catalogKeys.programs,
  movements: catalogKeys.movements,
  classes: (from: string, to: string) => ['classes', from, to] as const,
  allClasses: ['classes'] as const,
  roster: (classId: string) => ['roster', classId] as const,
  workouts: (date: string) => ['workouts', date] as const,
  allWorkouts: ['workouts'] as const,
  dashboard: (from: string, to: string) => ['dashboard', from, to] as const,
  debtors: ['debtors'] as const,
  bookingPolicy: ['settings', 'booking'] as const,
  schedules: ['schedules'] as const,
};
