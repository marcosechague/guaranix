import type { Bindings } from './env';
import { generateUpcomingClasses } from './jobs/upcoming-classes';
import { createRuntimeServices } from './services/runtime';

/** Cloudflare Cron Trigger entry point (`triggers.crons` in wrangler.jsonc). */
export async function runScheduledJobs(env: Bindings, scheduledTime: number): Promise<void> {
  const runtime = createRuntimeServices(env);
  try {
    const result = await generateUpcomingClasses(
      runtime.services.database(),
      new Date(scheduledTime),
    );
    console.log('Upcoming classes generated', {
      boxes: result.boxes,
      created: result.created,
      failed: result.failedBoxIds.length,
    });
    // Rethrow so the Cron Trigger shows as failed in Cloudflare and alerts can fire.
    if (result.failedBoxIds.length > 0) {
      throw new Error(`Class generation failed for ${result.failedBoxIds.length} boxes`);
    }
  } finally {
    await runtime.close();
  }
}
