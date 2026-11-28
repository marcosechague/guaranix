import { type ScopedTransaction, withSystemScope } from '@guaranix/db';
import { Hono, type Handler, type MiddlewareHandler } from 'hono';
import type { AppEnv, AuthenticatedSession } from '../env';
import { fail } from '../lib/http';
import { runRequestInTransaction } from '../lib/request-transaction';

export interface PlatformEnv extends AppEnv {
  Variables: AppEnv['Variables'] & {
    session: AuthenticatedSession;
    /**
     * Unscoped transaction: platform tools see every box. Only reachable by
     * platform admins, and every change to a box is written to `audit_logs`.
     */
    transaction: ScopedTransaction;
  };
}

/** GuaraniX's own staff only (`users.is_platform_admin`), never a box role. */
const platformScope: MiddlewareHandler<PlatformEnv> = async (context, next) => {
  if (!context.var.session?.isPlatformAdmin) return fail(context, 403, 'forbidden');
  const database = context.var.services.database();
  await runRequestInTransaction(context, next, (work) => withSystemScope(database, work));
};

/** Router for `/platform/...`: every route requires a platform admin. */
export function createPlatformRouter() {
  const router = new Hono<PlatformEnv>();
  router.use('*', platformScope);
  return {
    router,
    get: (path: string, handler: Handler<PlatformEnv>) => router.get(path, handler),
    post: (path: string, handler: Handler<PlatformEnv>) => router.post(path, handler),
    patch: (path: string, handler: Handler<PlatformEnv>) => router.patch(path, handler),
  };
}
