import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv } from './env';
import { healthRoutes } from './routes/health';

export function createApp() {
  const app = new Hono<AppEnv>();
  app.use('*', secureHeaders());
  app.route('/health', healthRoutes);
  app.notFound((context) => context.json({ error: 'not_found' }, 404));
  app.onError((error, context) => {
    // Never echo internal errors to the client; details stay in Workers logs.
    console.error('Unhandled API error', { name: error.name, path: context.req.path });
    return context.json({ error: 'internal_error' }, 500);
  });
  return app;
}
