import type { Bindings, Services } from './env';
import { runCardAutopay } from './jobs/card-autopay';
import { announceTomorrowsWorkouts } from './jobs/workout-announcements';
import { sendMembershipReminders } from './jobs/membership-reminders';
import { sweepNotifications } from './jobs/notification-sweeper';
import type { BoxJobResult } from './jobs/notifying-boxes';
import { generateUpcomingClasses } from './jobs/upcoming-classes';
import { paymentRuntimeFor } from './services/card-payment-runtime';
import { createRuntimeServices } from './services/runtime';

/**
 * Cron expressions in wrangler.jsonc `triggers.crons`, in UTC. Asunción is
 * UTC-3 all year, so 06:00 is 03:00 there, 12:00 is 09:00, 12:30 is 09:30 and 23:00 is 20:00.
 */
export const CRONS = {
  classes: '0 6 * * *',
  reminders: '0 12 * * *',
  cardAutopay: '30 12 * * *',
  workouts: '0 23 * * *',
  sweeper: '*/10 * * * *',
} as const;

function failIfAnyBoxFailed(label: string, result: BoxJobResult) {
  console.log(label, {
    boxes: result.boxes,
    notifications: result.notifications,
    failed: result.failedBoxIds.length,
  });
  // Rethrow so the Cron Trigger shows as failed in Cloudflare and alerts can fire.
  if (result.failedBoxIds.length > 0) {
    throw new Error(`${label} failed for ${result.failedBoxIds.length} boxes`);
  }
}

async function runJob(
  env: Bindings,
  services: Services,
  cron: string,
  now: Date,
): Promise<void> {
  const database = services.database();
  const queue = services.notifications.queue;
  switch (cron) {
    case CRONS.classes: {
      const result = await generateUpcomingClasses(database, now);
      console.log('Upcoming classes generated', {
        boxes: result.boxes,
        created: result.created,
        failed: result.failedBoxIds.length,
      });
      if (result.failedBoxIds.length > 0) {
        throw new Error(`Class generation failed for ${result.failedBoxIds.length} boxes`);
      }
      return;
    }
    case CRONS.reminders:
      return failIfAnyBoxFailed(
        'Membership reminders',
        await sendMembershipReminders(database, queue, now),
      );
    case CRONS.cardAutopay: {
      const result = await runCardAutopay(
        database,
        paymentRuntimeFor(env, services),
        { queue, notifier: services.paymentNotifier },
        now,
      );
      console.log('Card autopay finished', { ...result, failedBoxIds: result.failedBoxIds.length });
      if (result.failedBoxIds.length > 0) {
        throw new Error(`Card autopay failed for ${result.failedBoxIds.length} boxes`);
      }
      return;
    }
    case CRONS.workouts:
      return failIfAnyBoxFailed(
        'Workout announcements',
        await announceTomorrowsWorkouts(database, queue, now),
      );
    case CRONS.sweeper: {
      const swept = await sweepNotifications(database, queue, now);
      if (swept.expand + swept.send > 0) console.log('Notifications requeued', swept);
      return;
    }
    default:
      console.warn('Unknown cron', { cron });
  }
}

/** Cloudflare Cron Trigger entry point: one handler, dispatched by expression. */
export async function runScheduledJobs(
  env: Bindings,
  cron: string,
  scheduledTime: number,
): Promise<void> {
  const runtime = createRuntimeServices(env);
  try {
    await runJob(env, runtime.services, cron, new Date(scheduledTime));
  } finally {
    await runtime.close();
  }
}
