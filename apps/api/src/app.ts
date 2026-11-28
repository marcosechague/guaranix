import { Hono } from 'hono';
import { cors } from 'hono/cors';
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
import { onboardingRoutes } from './routes/onboarding';
import { platformRoutes } from './routes/platform';
import { createRuntimeServices } from './services/runtime';

export interface AppOptions {
  /** Tests pass fakes; production builds real integrations from the bindings. */
  services?: (env: Bindings) => Services;
}

export function createApp(options: AppOptions = {}) {
  const app = new Hono<AppEnv>();
  app.use('*', secureHeaders());
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
