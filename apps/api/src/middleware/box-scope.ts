import { type SchemaDatabase, type ScopedTransaction, withBoxScope } from '@guaranix/db';
import type { BoxRole } from '@guaranix/shared';
import { Hono, type Handler, type MiddlewareHandler } from 'hono';
import type { AppEnv, AuthenticatedSession } from '../env';
import { fail } from '../lib/http';
import { runRequestInTransaction } from '../lib/request-transaction';
import { queueOutbox } from '../services/notifications/outbox';
import { boxStatusOf, listMemberships } from '../services/sessions';

/** Who is calling and in which box. `boxId` always comes from the session, never the request. */
export interface BoxAuth {
  userId: string;
  boxId: string;
  role: BoxRole;
  /** The platform admin behind an "entrar como" request; audit entries carry it. */
  impersonatorUserId?: string;
}

export interface BoxEnv extends AppEnv {
  Variables: AppEnv['Variables'] & {
    session: AuthenticatedSession;
    auth: BoxAuth;
    /** Transaction already scoped to `auth.boxId` (Row Level Security). */
    transaction: ScopedTransaction;
    /** Notifications recorded by this request, queued once it commits. */
    outbox: string[];
  };
}

type BoxAuthResult = BoxAuth | { error: 'not_a_member' | 'box_suspended' | 'box_cancelled' };

/**
 * A platform admin impersonating a box acts as its owner (support needs to see
 * everything) without being on its staff. Everyone else needs an active
 * membership, and the box must not be suspended or removed.
 */
async function resolveBoxAuth(
  database: SchemaDatabase,
  session: AuthenticatedSession | null,
): Promise<BoxAuthResult> {
  if (!session) return { error: 'not_a_member' };
  if (session.impersonation) {
    // Support may enter a suspended box to fix it, never a removed one.
    const status = await boxStatusOf(database, session.impersonation.boxId);
    if (!status || status === 'cancelled') return { error: 'box_cancelled' };
    return {
      userId: session.userId,
      boxId: session.impersonation.boxId,
      role: 'box_owner',
      impersonatorUserId: session.userId,
    };
  }
  if (!session.activeBoxId) return { error: 'not_a_member' };
  const memberships = await listMemberships(database, session.userId);
  const membership = memberships.find((candidate) => candidate.boxId === session.activeBoxId);
  if (!membership) return { error: 'not_a_member' };
  if (membership.boxStatus === 'suspended') return { error: 'box_suspended' };
  if (membership.boxStatus === 'cancelled') return { error: 'box_cancelled' };
  return { userId: session.userId, boxId: membership.boxId, role: membership.role };
}

/**
 * Resolves the session's box and role, then runs the rest of the request in a
 * transaction scoped to that box. `box_id` always comes from the session,
 * never from the request. Error responses roll the transaction back.
 */
const boxScope: MiddlewareHandler<BoxEnv> = async (context, next) => {
  const session = context.var.session;
  const auth = await resolveBoxAuth(context.var.services.database(), session);
  if ('error' in auth) return fail(context, 403, auth.error);

  context.set('auth', auth);
  context.set('outbox', []);
  const database = context.var.services.database();
  await runRequestInTransaction(context, next, (work) =>
    withBoxScope(database, { boxId: auth.boxId, userId: auth.userId }, work),
  );
  if (context.error || context.res.status >= 400) return;
  await queueOutbox(context.var.services.notifications.queue, context.var.outbox);
};

/** Box routes that open their own short transactions (see `createBoxRouterWithoutTransaction`). */
export interface BoxAuthEnv extends AppEnv {
  Variables: AppEnv['Variables'] & { session: AuthenticatedSession; auth: BoxAuth };
}

const boxAuthOnly: MiddlewareHandler<BoxAuthEnv> = async (context, next) => {
  const auth = await resolveBoxAuth(context.var.services.database(), context.var.session);
  if ('error' in auth) return fail(context, 403, auth.error);
  context.set('auth', auth);
  return next();
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
    put: (path: string, roles: Roles, handler: Handler<BoxEnv>) =>
      router.put(path, authorize(roles), handler),
    delete: (path: string, roles: Roles, handler: Handler<BoxEnv>) =>
      router.delete(path, authorize(roles), handler),
  };
}

/**
 * Same session and role checks as `createBoxRouter`, but no request-wide
 * transaction: for routes that wait on an external service (an AI provider can
 * take a minute) and must not hold a database transaction open meanwhile. Their
 * services open short `withBoxScope` transactions themselves.
 */
export function createBoxRouterWithoutTransaction() {
  const router = new Hono<BoxAuthEnv>();
  router.use('*', boxAuthOnly);
  const allow =
    (roles: Roles): MiddlewareHandler<BoxAuthEnv> =>
    async (context, next) => {
      if (!roles.includes(context.var.auth.role)) return fail(context, 403, 'forbidden');
      return next();
    };
  return {
    router,
    post: (path: string, roles: Roles, handler: Handler<BoxAuthEnv>) =>
      router.post(path, allow(roles), handler),
  };
}
