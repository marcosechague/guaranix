import type { ScopedTransaction } from '@guaranix/db';
import type { BoxRole } from '@guaranix/shared/domain';

/** Who is acting, for which box. `boxId` always comes from the session, never the request. */
export interface ServiceAuth {
  userId: string;
  boxId: string;
  role: BoxRole;
}

/**
 * Everything a service needs: a transaction already inside `withBoxScope` for
 * `auth.boxId` (so RLS applies), the actor, and the current instant so tests
 * can control the clock.
 */
export interface ServiceContext {
  transaction: ScopedTransaction;
  auth: ServiceAuth;
  now: Date;
}

/** Roles that run the box. Members only ever see and change their own data. */
export const STAFF_ROLES = ['box_owner', 'box_admin', 'coach', 'reception'] as const;
export const MANAGER_ROLES = ['box_owner', 'box_admin'] as const;
export const FRONT_DESK_ROLES = ['box_owner', 'box_admin', 'reception'] as const;

export function isStaff(role: BoxRole): boolean {
  return (STAFF_ROLES as readonly BoxRole[]).includes(role);
}
