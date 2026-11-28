import type { ScopedTransaction } from '@guaranix/db';
import type { BoxRole } from '@guaranix/shared/domain';
import { ServiceError } from './errors';

/** Who is acting, for which box. `boxId` always comes from the session, never the request. */
export interface ServiceAuth {
  userId: string;
  boxId: string;
  role: BoxRole;
  /** Set when a platform admin acts "as" the box ("entrar como"). */
  impersonatorUserId?: string;
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
  /**
   * Notifications recorded during this request. The router queues them only
   * after the transaction commits, so a rolled-back change never notifies.
   * Absent in jobs and tests that queue on their own.
   */
  outbox?: string[];
}

/** Roles that run the box. Members only ever see and change their own data. */
export const STAFF_ROLES = ['box_owner', 'box_admin', 'coach', 'reception'] as const;
export const MANAGER_ROLES = ['box_owner', 'box_admin'] as const;
export const FRONT_DESK_ROLES = ['box_owner', 'box_admin', 'reception'] as const;
/** Who programs WODs. */
export const COACHING_ROLES = ['box_owner', 'box_admin', 'coach'] as const;
/** Staff who run a class on the floor: take attendance, see the roster. */
export const CLASS_STAFF_ROLES = ['box_owner', 'box_admin', 'coach', 'reception'] as const;

export function isStaff(role: BoxRole): boolean {
  return (STAFF_ROLES as readonly BoxRole[]).includes(role);
}

export function assertRole(role: BoxRole, allowed: readonly BoxRole[]): void {
  if (!allowed.includes(role)) throw new ServiceError(403, 'forbidden');
}
