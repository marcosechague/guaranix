import { createApp } from './app';
import type { Bindings } from './env';
import { runScheduledJobs } from './scheduled';

const app = createApp();

export default {
  fetch: app.fetch,
  scheduled(controller, env, context) {
    context.waitUntil(runScheduledJobs(env, controller.scheduledTime));
  },
} satisfies ExportedHandler<Bindings>;
