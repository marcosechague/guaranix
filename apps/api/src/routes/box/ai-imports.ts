import { aiImportRequestSchema } from '@guaranix/shared';
import { parseBody, respondWith } from '../../lib/service-route';
import { createBoxRouterWithoutTransaction } from '../../middleware/box-scope';
import { extractImportWithAi } from '../../services/ai-import';
import { consumeRateLimit, RATE_LIMITS } from '../../services/rate-limit';
import { MANAGERS } from './roles';

const aiImports = createBoxRouterWithoutTransaction();

// Proposes rows only; the admin reviews them in the normal preview before importing.
aiImports.post('/extract', MANAGERS, async (context) => {
  const limit = await consumeRateLimit(
    context.var.services.database(),
    context.env.AUTH_SECRET,
    RATE_LIMITS.aiImportByUser,
    context.var.auth.userId,
  );
  if (!limit.allowed) {
    context.header('retry-after', String(limit.retryAfterSeconds));
    return context.json({ error: 'rate_limited' }, 429);
  }
  return respondWith(context, async () =>
    extractImportWithAi(
      {
        database: context.var.services.database(),
        auth: context.var.auth,
        now: new Date(),
        ai: {
          secretsKey: context.env.AI_SECRETS_KEY,
          factory: context.var.services.aiProviderFactory,
        },
      },
      await parseBody(context, aiImportRequestSchema),
    ),
  );
});

export const aiImportRoutes = aiImports.router;
