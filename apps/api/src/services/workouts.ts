import { and, asc, count, eq, inArray, isNotNull } from 'drizzle-orm';
import type { z } from 'zod';
import { movements, workoutComponents, workoutResults, workouts } from '@guaranix/db/schema';
import type { createWorkoutSchema, movementSchema } from '@guaranix/shared/schemas';
import { notifyWorkoutPublished } from './notifications/events';
import { recordAudit } from './audit';
import { COACHING_ROLES, assertRole, isStaff, type ServiceContext } from './context';
import { conflict, isUniqueViolation, notFound, unprocessable } from './errors';
import { getProgram } from './programs';

export type WorkoutInput = z.output<typeof createWorkoutSchema>;
export type MovementInput = z.output<typeof movementSchema>;
type WorkoutRow = typeof workouts.$inferSelect;
type ComponentRow = typeof workoutComponents.$inferSelect;
export type WorkoutView = WorkoutRow & { components: ComponentRow[] };

export async function listMovements(context: ServiceContext) {
  return context.transaction.select().from(movements).orderBy(asc(movements.name));
}

export async function createMovement(context: ServiceContext, input: MovementInput) {
  assertRole(context.auth.role, COACHING_ROLES);
  const [movement] = await context.transaction
    .insert(movements)
    .values({ ...input, boxId: context.auth.boxId })
    .returning()
    .catch((error: unknown) => {
      if (isUniqueViolation(error)) throw conflict('movement_name_taken');
      throw error;
    });
  if (!movement) throw new Error('Movement insert returned no row');
  return movement;
}

async function withComponents(context: ServiceContext, rows: WorkoutRow[]): Promise<WorkoutView[]> {
  if (rows.length === 0) return [];
  const components = await context.transaction
    .select()
    .from(workoutComponents)
    .where(
      inArray(
        workoutComponents.workoutId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(workoutComponents.position));
  // Coach notes are for staff only; members (and their offline cache) never get them.
  const staff = isStaff(context.auth.role);
  return rows.map((row) => ({
    ...row,
    coachNotes: staff ? row.coachNotes : null,
    components: components.filter((component) => component.workoutId === row.id),
  }));
}

/** Members only ever see published WODs; staff also see drafts. */
export async function listWorkouts(
  context: ServiceContext,
  query: { date: string; programId?: string | undefined },
): Promise<WorkoutView[]> {
  const filters = [eq(workouts.workoutDate, query.date)];
  if (query.programId) filters.push(eq(workouts.programId, query.programId));
  if (!isStaff(context.auth.role)) filters.push(isNotNull(workouts.publishedAt));
  const rows = await context.transaction
    .select()
    .from(workouts)
    .where(and(...filters))
    .orderBy(asc(workouts.programId));
  return withComponents(context, rows);
}

export async function getWorkout(context: ServiceContext, workoutId: string): Promise<WorkoutView> {
  const [row] = await context.transaction.select().from(workouts).where(eq(workouts.id, workoutId));
  if (!row || (!row.publishedAt && !isStaff(context.auth.role))) throw notFound('workout');
  const [view] = await withComponents(context, [row]);
  if (!view) throw notFound('workout');
  return view;
}

async function assertComponentsValid(context: ServiceContext, input: WorkoutInput) {
  const positions = input.components.map((component) => component.position);
  if (new Set(positions).size !== positions.length)
    throw unprocessable('component_positions_repeated');
  const movementIds = [
    ...new Set(input.components.flatMap((component) => component.movementId ?? [])),
  ];
  if (movementIds.length === 0) return;
  const known = await context.transaction
    .select({ id: movements.id })
    .from(movements)
    .where(inArray(movements.id, movementIds));
  if (known.length !== movementIds.length) throw unprocessable('movement_not_found');
}

async function insertComponents(context: ServiceContext, workoutId: string, input: WorkoutInput) {
  await context.transaction
    .insert(workoutComponents)
    .values(
      input.components.map((component) => ({ ...component, workoutId, boxId: context.auth.boxId })),
    );
}

/** One WOD per program and day, saved as a draft until it's published. */
export async function createWorkout(context: ServiceContext, input: WorkoutInput) {
  assertRole(context.auth.role, COACHING_ROLES);
  await getProgram(context, input.programId);
  await assertComponentsValid(context, input);
  const [existing] = await context.transaction
    .select({ id: workouts.id })
    .from(workouts)
    .where(
      and(eq(workouts.programId, input.programId), eq(workouts.workoutDate, input.workoutDate)),
    );
  if (existing) throw conflict('workout_exists');
  const [workout] = await context.transaction
    .insert(workouts)
    .values({
      programId: input.programId,
      workoutDate: input.workoutDate,
      title: input.title,
      coachNotes: input.coachNotes,
      boxId: context.auth.boxId,
      createdByUserId: context.auth.userId,
    })
    .returning();
  if (!workout) throw new Error('Workout insert returned no row');
  await insertComponents(context, workout.id, input);
  return getWorkout(context, workout.id);
}

async function resultCount(context: ServiceContext, workoutId: string): Promise<number> {
  const [row] = await context.transaction
    .select({ total: count() })
    .from(workoutResults)
    .innerJoin(workoutComponents, eq(workoutComponents.id, workoutResults.componentId))
    .where(eq(workoutComponents.workoutId, workoutId));
  return row?.total ?? 0;
}

/**
 * Replaces a WOD and its components. Once members logged results the
 * structure is locked, since replacing components would delete their scores.
 */
export async function updateWorkout(
  context: ServiceContext,
  workoutId: string,
  input: WorkoutInput,
) {
  assertRole(context.auth.role, COACHING_ROLES);
  const before = await getWorkout(context, workoutId);
  if (input.programId !== before.programId || input.workoutDate !== before.workoutDate) {
    throw unprocessable('workout_move_not_allowed');
  }
  if ((await resultCount(context, workoutId)) > 0) throw conflict('workout_has_results');
  await assertComponentsValid(context, input);
  await context.transaction
    .update(workouts)
    .set({ title: input.title, coachNotes: input.coachNotes })
    .where(eq(workouts.id, workoutId));
  await context.transaction
    .delete(workoutComponents)
    .where(eq(workoutComponents.workoutId, workoutId));
  await insertComponents(context, workoutId, input);
  return getWorkout(context, workoutId);
}

export async function setWorkoutPublished(
  context: ServiceContext,
  workoutId: string,
  published: boolean,
) {
  assertRole(context.auth.role, COACHING_ROLES);
  await getWorkout(context, workoutId);
  await context.transaction
    .update(workouts)
    .set({ publishedAt: published ? context.now : null })
    .where(eq(workouts.id, workoutId));
  await recordAudit(context, {
    action: published ? 'workout.published' : 'workout.unpublished',
    entityType: 'workout',
    entityId: workoutId,
  });
  if (published) await notifyWorkoutPublished(context, workoutId);
  return getWorkout(context, workoutId);
}

export async function deleteWorkout(context: ServiceContext, workoutId: string): Promise<void> {
  assertRole(context.auth.role, COACHING_ROLES);
  await getWorkout(context, workoutId);
  if ((await resultCount(context, workoutId)) > 0) throw conflict('workout_has_results');
  await context.transaction
    .delete(workoutComponents)
    .where(eq(workoutComponents.workoutId, workoutId));
  await context.transaction.delete(workouts).where(eq(workouts.id, workoutId));
}
