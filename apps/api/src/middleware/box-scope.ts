import { type ScopedTransaction, withBoxScope } from '@guaranix/db';
import type { BoxRole } from '@guaranix/shared';
import { Hono, type Handler, type MiddlewareHandler } from 'hono';
import type { AppEnv, AuthenticatedSession } from '../env';
import { fail } from '../lib/http';
import { listMemberships } from '../services/sessions';

/** Who is calling and in which box. `boxId` always comes from the session, never the request. */
export interface BoxAuth {
  userId: string;
  boxId: string;
  role: BoxRole;
}

export interface BoxEnv extends AppEnv {
  Variables: AppEnv['Variables'] & {
    session: AuthenticatedSession;
    auth: BoxAuth;
    /** Transaction already scoped to `auth.boxId` (Row Level Security). */
    transaction: ScopedTransaction;
  };
}

class Rollback extends Error {}

/**
 * Resolves the session's box and role, then runs the rest of the request in a
 * transaction scoped to that box. `box_id` always comes from the session,
 * never from the request. Error responses roll the transaction back.
 */
const boxScope: MiddlewareHandler<BoxEnv> = async (context, next) => {
  const session = context.var.session;
  if (!session?.activeBoxId) return fail(context, 403, 'not_a_member');
  const database = context.var.services.database();
  const memberships = await listMemberships(database, session.userId);
  const membership = memberships.find((candidate) => candidate.boxId === session.activeBoxId);
  if (!membership) return fail(context, 403, 'not_a_member');

  context.set('auth', { userId: session.userId, boxId: membership.boxId, role: membership.role });
  try {
    await withBoxScope(
      database,
      { boxId: membership.boxId, userId: session.userId },
      async (transaction) => {
        context.set('transaction', transaction);
        await next();
        // Hono turns thrown errors into a 500 response before we get here.
        if (context.error) throw context.error;
        if (context.res.status >= 400) throw new Rollback();
      },
    );
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
};

type Roles = readonly [BoxRole, ...BoxRole[]];

/** 403 unless the user's role in the active box is one of `roles`. */
export function authorize(roles: Roles): MiddlewareHandler<BoxEnv> {
  return async (context, next) => {
    if (!roles.includes(context.var.auth.role)) return fail(context, 403, 'forbidden');
    return next();
  };
}

/**
 * Router for box data. Every route must name the roles allowed to call it, so
 * forgetting the authorization check does not compile.
 */
export function createBoxRouter() {
  const router = new Hono<BoxEnv>();
  router.use('*', boxScope);
  return {
    router,
    get: (path: string, roles: Roles, handler: Handler<BoxEnv>) =>
      router.get(path, authorize(roles), handler),
    post: (path: string, roles: Roles, handler: Handler<BoxEnv>) =>
      router.post(path, authorize(roles), handler),
    patch: (path: string, roles: Roles, handler: Handler<BoxEnv>) =>
      router.patch(path, authorize(roles), handler),
    delete: (path: string, roles: Roles, handler: Handler<BoxEnv>) =>
      router.delete(path, authorize(roles), handler),
  };
}

/** For GuaraniX's own superadmin routes. */
export const requirePlatformAdmin: MiddlewareHandler<AppEnv> = async (context, next) => {
  if (!context.var.session?.isPlatformAdmin) return fail(context, 403, 'forbidden');
  return next();
};
