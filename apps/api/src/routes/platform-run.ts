import type { Context } from 'hono';
import { respondWith } from '../lib/service-route';
import type { PlatformEnv } from '../middleware/platform-scope';
import type { PlatformContext } from '../services/platform-context';

type PlatformRequest = Context<PlatformEnv>;

function platformContext(context: PlatformRequest): PlatformContext {
  const session = context.var.session;
  return {
    transaction: context.var.transaction,
    actorUserId: session.userId,
    sessionId: session.id,
    now: new Date(),
  };
}

export const run = (
  context: PlatformRequest,
  work: (service: PlatformContext) => Promise<unknown>,
  status: 200 | 201 = 200,
) => respondWith(context, () => work(platformContext(context)), status);
