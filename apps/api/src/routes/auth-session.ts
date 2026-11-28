import { type AuthConfig, logoutSchema, selectBoxSchema } from '@guaranix/shared';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { clearSessionCookie } from '../lib/cookies';
import { fail, readBody } from '../lib/http';
import { unlinkGoogle } from '../services/google-auth';
import { logOut, selectActiveBox } from '../services/sessions';
import { respondWithSession } from './auth-helpers';

// Apart from /config, the auth gate guarantees a session (and a CSRF token on writes).
export const sessionRoutes = new Hono<AppEnv>()
  .get('/config', (context) => {
    const { captcha, google } = context.var.services;
    const config: AuthConfig = {
      googleEnabled: google !== null,
      turnstileSiteKey: captcha ? (context.env.TURNSTILE_SITE_KEY ?? null) : null,
    };
    return context.json(config);
  })

  .get('/session', async (context) => {
    const session = context.var.session;
    if (!session) return fail(context, 401, 'unauthenticated');
    return respondWithSession(context, session.token);
  })

  .post('/session/box', async (context) => {
    const session = context.var.session;
    if (!session) return fail(context, 401, 'unauthenticated');
    const input = await readBody(context, selectBoxSchema);
    if (!input) return fail(context, 400, 'validation_failed');
    const selected = await selectActiveBox(context.var.services.database(), session, input.boxId);
    if (!selected) return fail(context, 403, 'not_a_member');
    return respondWithSession(context, session.token);
  })

  .delete('/google', async (context) => {
    const session = context.var.session;
    if (!session) return fail(context, 401, 'unauthenticated');
    const error = await unlinkGoogle(context.var.services.database(), session.userId);
    if (error) return fail(context, 409, error);
    return respondWithSession(context, session.token);
  })

  .post('/logout', async (context) => {
    const session = context.var.session;
    // The body is optional: an old client logs out without it.
    const input = (await readBody(context, logoutSchema)) ?? {};
    if (session) await logOut(context.var.services.database(), session, input.pushEndpoint);
    clearSessionCookie(context);
    return context.body(null, 204);
  });
