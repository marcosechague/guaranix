import { boxSignupSchema } from '@guaranix/shared';
import { parseBody, respondWith } from '../lib/service-route';
import { createAccountRouter } from '../middleware/account-scope';
import { SetupRejected, signUpBox } from '../services/box-signup';
import { consumeRateLimit, RATE_LIMITS } from '../services/rate-limit';

const onboarding = createAccountRouter();

/** Self-service sign-up of a box by its owner (PRD: "registro en 3 minutos"). */
onboarding.post('/box', async (context) => {
  const session = context.var.session;
  // Counted inside the request's transaction: only boxes actually created use up the limit.
  const limit = await consumeRateLimit(
    context.var.transaction,
    context.env.AUTH_SECRET,
    RATE_LIMITS.boxSignupByUser,
    session.userId,
  );
  if (!limit.allowed) {
    context.header('retry-after', String(limit.retryAfterSeconds));
    return context.json({ error: 'rate_limited' }, 429);
  }
  try {
    return await respondWith(
      context,
      async () =>
        signUpBox(
          context.var.transaction,
          { userId: session.userId, sessionId: session.id },
          await parseBody(context, boxSignupSchema),
          new Date(),
        ),
      201,
    );
  } catch (error) {
    // The screen points at each problem, so the issues travel with the code.
    if (error instanceof SetupRejected) {
      return context.json({ error: error.code, issues: error.issues }, 422);
    }
    throw error;
  }
});

export const onboardingRoutes = onboarding.router;
