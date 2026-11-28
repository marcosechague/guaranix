import { createApp } from './app';
import type { Bindings } from './env';
import { runScheduledJobs } from './scheduled';
import { handleNotificationBatch } from './services/notifications/consumer';
import type { NotificationJob } from './services/notifications/queue';
import { createRuntimeServices } from './services/runtime';

const app = createApp();

export default {
  fetch: app.fetch,
  scheduled(controller, env, context) {
    context.waitUntil(runScheduledJobs(env, controller.cron, controller.scheduledTime));
  },
  /** Consumer of `guaranix-notifications`: expands events and sends each delivery. */
  async queue(batch, env) {
    const runtime = createRuntimeServices(env);
    try {
      await handleNotificationBatch(
        runtime.services.database(),
        runtime.services.notifications,
        batch.messages,
        new Date(),
      );
    } finally {
      await runtime.close();
    }
  },
} satisfies ExportedHandler<Bindings, NotificationJob>;
