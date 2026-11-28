import { type ScopedTransaction, withSystemScope } from '@guaranix/db';
import { Hono, type Handler, type MiddlewareHandler } from 'hono';
import type { AppEnv, AuthenticatedSession } from '../env';
import { fail } from '../lib/http';
import { runRequestInTransaction } from '../lib/request-transaction';

export interface AccountEnv extends AppEnv {
  Variables: AppEnv['Variables'] & {
    session: AuthenticatedSession;
    /**
     * Unscoped, because these routes act before the caller has a box (creating
     * one). Services only touch rows they create or the caller's own account.
     */
    transaction: ScopedTransaction;
  };
}

const accountScope: MiddlewareHandler<AccountEnv> = async (context, next) => {
  if (!context.var.session) return fail(context, 401, 'unauthenticated');
  const database = context.var.services.database();
  await runRequestInTransaction(context, next, (work) => withSystemScope(database, work));
};

/** Router for a signed-in person's own account, outside any box (`/onboarding/...`). */
export function createAccountRouter() {
  const router = new Hono<AccountEnv>();
  router.use('*', accountScope);
  return {
    router,
    get: (path: string, handler: Handler<AccountEnv>) => router.get(path, handler),
    post: (path: string, handler: Handler<AccountEnv>) => router.post(path, handler),
  };
}
