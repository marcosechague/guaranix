import { Hono, type MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv, Bindings, Services } from './env';
import { allowedOrigins } from './lib/http';
import { authGate } from './middleware/auth-gate';
import { googleAuthRoutes } from './routes/auth-google';
import { passwordAuthRoutes } from './routes/auth-password';
import { sessionRoutes } from './routes/auth-session';
import { boxRoutes } from './routes/box';
import { mountBoxRoutes } from './routes/box/index';
import { healthRoutes } from './routes/health';
import { notificationRoutes } from './routes/notifications';
import { onboardingRoutes } from './routes/onboarding';
import { platformRoutes } from './routes/platform';
import { telegramWebhookRoutes } from './routes/telegram-webhook';
import { createRuntimeServices } from './services/runtime';

export interface AppOptions {
  /** Tests pass fakes; production builds real integrations from the bindings. */
  services?: (env: Bindings) => Services;
}

const KILOBYTE = 1024;
const MEGABYTE = 1024 * KILOBYTE;

/** Spreadsheets and files for the import tools. */
const LARGE_BODY_PATHS = ['/box/imports', '/box/ai-imports'];
/** Raw uploads that cap their own stream with a specific error (`readUpload`). */
const SELF_LIMITED_PATHS = ['/box/receipts'];

const largeBodyLimit = bodyLimit({
  maxSize: 12 * MEGABYTE,
  onError: (context) => context.json({ error: 'payload_too_large' }, 413),
});
const defaultBodyLimit = bodyLimit({
  maxSize: 128 * KILOBYTE,
  onError: (context) => context.json({ error: 'payload_too_large' }, 413),
});

/**
 * Caps every body before anyone parses it: Zod only checks lengths after the
 * whole JSON is in memory, so without this a public route could be fed 100 MB.
 */
const limitRequestBody: MiddlewareHandler<AppEnv> = (context, next) => {
  const matches = (paths: string[]) => paths.some((path) => context.req.path.startsWith(path));
  if (matches(SELF_LIMITED_PATHS)) return next();
  return matches(LARGE_BODY_PATHS)
    ? largeBodyLimit(context, next)
    : defaultBodyLimit(context, next);
};

export function createApp(options: AppOptions = {}) {
  const app = new Hono<AppEnv>();
  app.use('*', secureHeaders());
  app.use('*', limitRequestBody);
  app.use('*', (context, next) =>
    cors({
      origin: (origin) => (allowedOrigins(context).includes(origin) ? origin : null),
      credentials: true,
      allowHeaders: ['content-type', 'x-csrf-token'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      maxAge: 600,
    })(context, next),
  );
  app.use('*', async (context, next) => {
    if (options.services) {
      context.set('services', options.services(context.env));
      return next();
    }
    const runtime = createRuntimeServices(context.env);
    context.set('services', runtime.services);
    try {
      await next();
    } finally {
      await runtime.close();
    }
  });
  app.use('*', authGate);

  app.route('/health', healthRoutes);
  app.route('/auth', passwordAuthRoutes);
  app.route('/auth', sessionRoutes);
  app.route('/auth/google', googleAuthRoutes);
  // Before `/box`: its catch-all box scope would otherwise open a second, nested transaction.
  app.route('/platform', platformRoutes);
  app.route('/onboarding', onboardingRoutes);
  app.route('/notifications', notificationRoutes);
  app.route('/integrations/telegram', telegramWebhookRoutes);
  mountBoxRoutes(app);
  app.route('/box', boxRoutes);

  app.notFound((context) => context.json({ error: 'not_found' }, 404));
  app.onError((error, context) => {
    // Never echo internal errors to the client; details stay in Workers logs.
    console.error('Unhandled API error', { name: error.name, path: context.req.path });
    return context.json({ error: 'internal_error' }, 500);
  });
  return app;
}
