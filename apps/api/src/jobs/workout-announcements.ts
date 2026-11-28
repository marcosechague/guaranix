import type { SchemaDatabase } from '@guaranix/db';
import { workouts } from '@guaranix/db/schema';
import { addDays, calendarDateIn } from '@guaranix/shared';
import { and, eq, isNotNull } from 'drizzle-orm';
import { workoutAnnouncement } from '../services/notifications/events';
import { insertNotification } from '../services/notifications/record';
import type { NotificationQueue } from '../services/notifications/queue';
import { type BoxJobResult, forEachNotifyingBox } from './notifying-boxes';

/**
 * Evening job: announces tomorrow's published WODs that were loaded days ahead
 * (publishing one for today or tomorrow already announced it, and the shared
 * key keeps it to one notification).
 */
export async function announceTomorrowsWorkouts(
  database: SchemaDatabase,
  queue: NotificationQueue,
  now: Date,
): Promise<BoxJobResult> {
  return forEachNotifyingBox(database, queue, 'Workout announcements', async (transaction, box) => {
    const tomorrow = addDays(calendarDateIn(box.timezone, now), 1);
    const published = await transaction
      .select({
        id: workouts.id,
        programId: workouts.programId,
        date: workouts.workoutDate,
        title: workouts.title,
      })
      .from(workouts)
      .where(and(eq(workouts.workoutDate, tomorrow), isNotNull(workouts.publishedAt)));
    const ids: string[] = [];
    for (const workout of published) {
      const event = await workoutAnnouncement(transaction, workout.id, workout);
      const id = await insertNotification(
        transaction,
        { boxId: box.id, actorUserId: null, now },
        event,
      );
      if (id) ids.push(id);
    }
    return ids;
  });
}
