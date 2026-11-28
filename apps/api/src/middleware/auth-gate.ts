import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';
import { clearSessionCookie, readSessionCookie } from '../lib/cookies';
import { constantTimeEqual } from '../lib/crypto';
import { allowedOrigins, fail } from '../lib/http';
import { csrfTokenFor, findSession } from '../services/sessions';

/**
 * The only routes reachable without a session. Everything else needs one:
 * a new route is private until someone adds it here on purpose.
 */
export const PUBLIC_ROUTES = new Set([
  'GET /health',
  'GET /auth/config',
  'POST /auth/signup',
  'POST /auth/login',
  'POST /auth/password/forgot',
  'POST /auth/password/reset',
  'GET /auth/google/start',
  'GET /auth/google/callback',
]);

/**
 * Server-to-server callbacks (no browser, no Origin, no cookie). Each one
 * proves who is calling on its own, e.g. Telegram's secret token header or a
 * card processor's signature, checked first thing in its handler.
 */
export const WEBHOOK_ROUTES = new Set(['POST /integrations/telegram/webhook']);
/** Card processor confirmations, one URL per box account. Exact shape, so nothing else slips in. */
const PAYMENT_WEBHOOK = /^POST \/webhooks\/payments\/[0-9a-f-]{36}$/;

/** Payment link pages (secret token in the URL). Writes still need our Origin. */
const PAYMENT_LINK =
  /^(GET \/pay\/[A-Za-z0-9_-]{43}|POST \/pay\/[A-Za-z0-9_-]{43}\/(checkout|simulate))$/;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * 1. Writes must come from one of our apps (Origin check). This also stops
 *    login CSRF, where another site logs you into its account.
 * 2. Loads the session from the cookie.
 * 3. Denies by default: private routes need a session, and writes on them
 *    need the session's CSRF token in `X-CSRF-Token`.
 */
export const authGate: MiddlewareHandler<AppEnv> = async (context, next) => {
  const method = context.req.method;
  const route = `${method} ${context.req.path}`;
  if (WEBHOOK_ROUTES.has(route) || PAYMENT_WEBHOOK.test(route)) {
    context.set('session', null);
    return next();
  }
  const isWrite = !SAFE_METHODS.has(method);
  if (isWrite) {
    const origin = context.req.header('origin');
    if (!origin || !allowedOrigins(context).includes(origin)) {
      return fail(context, 403, 'csrf_failed');
    }
  }

  const token = readSessionCookie(context);
  const session = token ? await findSession(context.var.services.database(), token) : null;
  if (token && !session) clearSessionCookie(context);
  context.set('session', session);

  if (PUBLIC_ROUTES.has(`${method} ${context.req.path}`)) return next();
  if (PAYMENT_LINK.test(route)) return next();
  if (!session) return fail(context, 401, 'unauthenticated');
  if (isWrite) {
    const expected = await csrfTokenFor(context.env.AUTH_SECRET, session.token);
    const received = context.req.header('x-csrf-token') ?? '';
    if (!constantTimeEqual(received, expected)) return fail(context, 403, 'csrf_failed');
  }
  return next();
};
