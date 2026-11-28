import type { Bindings } from './env';
import { runCardAutopay } from './jobs/card-autopay';
import { generateUpcomingClasses } from './jobs/upcoming-classes';
import { paymentRuntimeFor } from './services/card-payment-runtime';
import { createRuntimeServices } from './services/runtime';

/** `triggers.crons` in wrangler.jsonc. */
export const CLASS_GENERATION_CRON = '0 6 * * *';
export const CARD_AUTOPAY_CRON = '0 12 * * *';

async function classGeneration(env: Bindings, now: Date) {
  const runtime = createRuntimeServices(env);
  try {
    const result = await generateUpcomingClasses(runtime.services.database(), now);
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

async function cardAutopay(env: Bindings, now: Date) {
  const runtime = createRuntimeServices(env);
  try {
    const result = await runCardAutopay(
      runtime.services.database(),
      paymentRuntimeFor(env, runtime.services),
      runtime.services.paymentNotifier,
      now,
    );
    console.log('Card autopay finished', { ...result, failedBoxIds: result.failedBoxIds.length });
    if (result.failedBoxIds.length > 0) {
      throw new Error(`Card autopay failed for ${result.failedBoxIds.length} boxes`);
    }
  } finally {
    await runtime.close();
  }
}

/** Cloudflare Cron Trigger entry point: each schedule runs its own job. */
export async function runScheduledJobs(
  env: Bindings,
  scheduledTime: number,
  cron: string,
): Promise<void> {
  const now = new Date(scheduledTime);
  if (cron === CARD_AUTOPAY_CRON) return cardAutopay(env, now);
  return classGeneration(env, now);
}
