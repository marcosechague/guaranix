import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  setPasswordSchema,
  signupSchema,
  t,
} from '@guaranix/shared';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { fail, readBody } from '../lib/http';
import {
  createPasswordReset,
  login,
  RESET_TOKEN_LIFETIME_MINUTES,
  resetPassword,
  setPassword,
  signup,
  type SetPasswordError,
} from '../services/password-auth';
import { RATE_LIMITS } from '../services/rate-limit';
import { createSession } from '../services/sessions';
import { captchaFailed, ipSubject, rateLimited, respondWithSession } from './auth-helpers';

const SET_PASSWORD_STATUS = {
  current_password_required: 400,
  invalid_credentials: 401,
  recent_sign_in_required: 403,
} as const satisfies Record<SetPasswordError, number>;

export const passwordAuthRoutes = new Hono<AppEnv>()
  .post('/signup', async (context) => {
    const input = await readBody(context, signupSchema);
    if (!input) return fail(context, 400, 'validation_failed');
    const blocked =
      (await rateLimited(context, RATE_LIMITS.signupByIp, ipSubject(context))) ??
      (await captchaFailed(context, input.captchaToken));
    if (blocked) return blocked;

    const database = context.var.services.database();
    const result = await signup(database, context.env.AUTH_SECRET, input);
    if ('error' in result) return fail(context, 409, result.error);
    return respondWithSession(context, await createSession(database, result.userId));
  })

  .post('/login', async (context) => {
    const input = await readBody(context, loginSchema);
    if (!input) return fail(context, 400, 'validation_failed');
    const blocked =
      (await rateLimited(context, RATE_LIMITS.loginByIp, ipSubject(context))) ??
      (await rateLimited(context, RATE_LIMITS.loginByEmail, input.email)) ??
      (await captchaFailed(context, input.captchaToken));
    if (blocked) return blocked;

    const database = context.var.services.database();
    const userId = await login(database, context.env.AUTH_SECRET, input.email, input.password);
    if (!userId) return fail(context, 401, 'invalid_credentials');
    return respondWithSession(context, await createSession(database, userId));
  })

  .post('/password/forgot', async (context) => {
    const input = await readBody(context, forgotPasswordSchema);
    if (!input) return fail(context, 400, 'validation_failed');
    const blocked =
      (await rateLimited(context, RATE_LIMITS.forgotByIp, ipSubject(context))) ??
      (await rateLimited(context, RATE_LIMITS.forgotByEmail, input.email)) ??
      (await captchaFailed(context, input.captchaToken));
    if (blocked) return blocked;

    const reset = await createPasswordReset(context.var.services.database(), input.email);
    if (reset) {
      // The auth gate already checked Origin against the allowlist, so the link
      // goes back to the same app the person asked from.
      const origin = context.req.header('origin') ?? '';
      const link = `${origin}/reset-password?token=${encodeURIComponent(reset.token)}`;
      await context.var.services.emailSender.send({
        to: input.email,
        subject: t('auth.email.resetSubject'),
        text: t('auth.email.resetBody', {
          name: reset.fullName,
          link,
          minutes: RESET_TOKEN_LIFETIME_MINUTES,
        }),
      });
    }
    // Same answer for unknown emails, so this cannot be used to find accounts.
    return context.json({ status: 'sent' }, 202);
  })

  .post('/password/reset', async (context) => {
    const input = await readBody(context, resetPasswordSchema);
    if (!input) return fail(context, 400, 'validation_failed');
    const blocked = await rateLimited(context, RATE_LIMITS.resetByIp, ipSubject(context));
    if (blocked) return blocked;

    const database = context.var.services.database();
    const userId = await resetPassword(
      database,
      context.env.AUTH_SECRET,
      input.token,
      input.password,
    );
    if (!userId) return fail(context, 400, 'invalid_reset_token');
    return respondWithSession(context, await createSession(database, userId));
  })

  .post('/password', async (context) => {
    const session = context.var.session;
    if (!session) return fail(context, 401, 'unauthenticated');
    const input = await readBody(context, setPasswordSchema);
    if (!input) return fail(context, 400, 'validation_failed');
    const blocked = await rateLimited(context, RATE_LIMITS.passwordChangeByUser, session.userId);
    if (blocked) return blocked;

    const error = await setPassword(context.var.services.database(), context.env.AUTH_SECRET, {
      userId: session.userId,
      sessionId: session.id,
      newPassword: input.newPassword,
      ...(input.currentPassword === undefined ? {} : { currentPassword: input.currentPassword }),
    });
    if (error) return fail(context, SET_PASSWORD_STATUS[error], error);
    return respondWithSession(context, session.token);
  });
