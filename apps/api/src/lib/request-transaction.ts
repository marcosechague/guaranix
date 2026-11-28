import type { ScopedTransaction } from '@guaranix/db';
import type { Context, Env, Next } from 'hono';

class Rollback extends Error {}

type OpenTransaction = (
  work: (transaction: ScopedTransaction) => Promise<void>,
) => Promise<unknown>;

/**
 * Runs the rest of the request inside the transaction `open` starts, exposed as
 * `context.var.transaction`. Any error response rolls it back, so a failed
 * request never leaves half its writes behind.
 */
export async function runRequestInTransaction<
  E extends Env & { Variables: { transaction: ScopedTransaction } },
>(context: Context<E>, next: Next, open: OpenTransaction): Promise<void> {
  try {
    await open(async (transaction) => {
      context.set('transaction', transaction);
      await next();
      // Hono turns thrown errors into a 500 response before we get here.
      if (context.error) throw context.error;
      if (context.res.status >= 400) throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}
