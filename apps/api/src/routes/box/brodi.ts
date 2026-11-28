import { brodiQuestionSchema } from '@guaranix/shared';
import { parseBody, respond, respondWith } from '../../lib/service-route';
import { createBoxRouter, createBoxRouterWithoutTransaction } from '../../middleware/box-scope';
import { askBrodi, brodiOverview } from '../../services/brodi/ask';
import { consumeRateLimit, RATE_LIMITS } from '../../services/rate-limit';
import { MANAGERS } from './roles';

const overview = createBoxRouter();

overview.get('/', MANAGERS, (context) => respond(context, brodiOverview));

export const brodiRoutes = overview.router;

const questions = createBoxRouterWithoutTransaction();

// Read-only: Brodi answers from the box's own figures and changes nothing but the conversation.
questions.post('/', MANAGERS, async (context) => {
  const limit = await consumeRateLimit(
    context.var.services.database(),
    context.env.AUTH_SECRET,
    RATE_LIMITS.brodiByUser,
    context.var.auth.userId,
  );
  if (!limit.allowed) {
    context.header('retry-after', String(limit.retryAfterSeconds));
    return context.json({ error: 'rate_limited' }, 429);
  }
  return respondWith(context, async () =>
    askBrodi(
      {
        database: context.var.services.database(),
        auth: context.var.auth,
        now: new Date(),
        ai: {
          secretsKey: context.env.AI_SECRETS_KEY,
          factory: context.var.services.aiProviderFactory,
        },
      },
      await parseBody(context, brodiQuestionSchema),
    ),
  );
});

export const brodiQuestionRoutes = questions.router;
