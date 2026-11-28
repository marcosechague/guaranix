import type { BoxRole } from '@guaranix/shared/domain';

// Same groups as the API (apps/api/src/routes/box/roles.ts); the API enforces them again.
const MANAGERS: readonly BoxRole[] = ['box_owner', 'box_admin'];
const FRONT_DESK: readonly BoxRole[] = ['box_owner', 'box_admin', 'reception'];
const COACHING: readonly BoxRole[] = ['box_owner', 'box_admin', 'coach'];

export const canManage = (role: BoxRole | undefined) =>
  role !== undefined && MANAGERS.includes(role);
export const canFrontDesk = (role: BoxRole | undefined) =>
  role !== undefined && FRONT_DESK.includes(role);
export const canCoach = (role: BoxRole | undefined) =>
  role !== undefined && COACHING.includes(role);
