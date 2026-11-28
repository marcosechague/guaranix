import { and, asc, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import {
  members,
  personalRecords,
  resultFistBumps,
  workoutComponents,
  workoutResults,
  workouts,
} from '@guaranix/db/schema';
import { missingScoreFields, type WorkoutResultInput } from '@guaranix/shared/schemas';
import type { ScoreType } from '@guaranix/shared/domain';
import { isStaff, type ServiceContext } from './context';
import { notFound, unprocessable } from './errors';
import { getMember, getOwnMember } from './members';

type ResultRow = typeof workoutResults.$inferSelect;
type ComponentRow = typeof workoutComponents.$inferSelect;
type ScoreFields = Omit<WorkoutResultInput, 'componentId' | 'memberId' | 'scaling' | 'notes'>;

/** A component members can score: its WOD must be published (staff may score drafts). */
async function scorableComponent(context: ServiceContext, componentId: string) {
  const [row] = await context.transaction
    .select({ component: workoutComponents, workout: workouts })
    .from(workoutComponents)
    .innerJoin(workouts, eq(workouts.id, workoutComponents.workoutId))
    .where(eq(workoutComponents.id, componentId));
  if (!row || (!row.workout.publishedAt && !isStaff(context.auth.role))) {
    throw notFound('component');
  }
  return row;
}

/** Members log their own score; staff can log one for any member (e.g. from the whiteboard). */
async function resolveMember(context: ServiceContext, memberId: string | undefined) {
  if (!isStaff(context.auth.role)) {
    const own = await getOwnMember(context);
    if (memberId !== undefined && memberId !== own.id) throw notFound('member');
    return own;
  }
  if (memberId === undefined) throw unprocessable('member_required');
  return getMember(context, memberId);
}

/**
 * Fields other than the ones the score type uses are cleared, so leaderboards
 * stay clean. A part based on a movement also keeps the load the member used
 * (the guided mode's weight), which is not a personal record by itself.
 */
function scoreFor(component: ComponentRow, input: ScoreFields): ScoreFields {
  const { scoreType } = component;
  const keep = (field: keyof ScoreFields) => {
    const used: Record<ScoreType, (keyof ScoreFields)[]> = {
      none: [],
      time: ['timeSeconds', 'rounds', 'reps'],
      rounds_reps: ['rounds', 'reps'],
      reps: ['reps'],
      load: ['loadGrams'],
      distance: ['distanceMeters', 'timeSeconds'],
      calories: ['calories'],
      points: ['points'],
    };
    const usedLoad = field === 'loadGrams' && component.movementId !== null;
    return used[scoreType].includes(field) || usedLoad ? input[field] : null;
  };
  return {
    timeSeconds: keep('timeSeconds'),
    rounds: keep('rounds'),
    reps: keep('reps'),
    loadGrams: keep('loadGrams'),
    distanceMeters: keep('distanceMeters'),
    calories: keep('calories'),
    points: keep('points'),
  };
}

/**
 * A new best load for the movement becomes a personal record. Returns whether
 * it was one, so the app can celebrate with Brodi.
 */
async function recordPersonalBest(
  context: ServiceContext,
  component: ComponentRow,
  result: ResultRow,
  achievedOn: string,
): Promise<boolean> {
  if (component.scoreType !== 'load' || !component.movementId || result.loadGrams === null) {
    return false;
  }
  const [best] = await context.transaction
    .select({ loadGrams: personalRecords.loadGrams })
    .from(personalRecords)
    .where(
      and(
        eq(personalRecords.memberId, result.memberId),
        eq(personalRecords.movementId, component.movementId),
        isNull(personalRecords.repMax),
      ),
    )
    .orderBy(desc(personalRecords.loadGrams))
    .limit(1);
  if (best?.loadGrams != null && best.loadGrams >= result.loadGrams) return false;
  await context.transaction.insert(personalRecords).values({
    boxId: context.auth.boxId,
    memberId: result.memberId,
    movementId: component.movementId,
    loadGrams: result.loadGrams,
    achievedOn,
    resultId: result.id,
  });
  return true;
}

/** Saves (or corrects) a score. One result per member and component. */
export async function logResult(
  context: ServiceContext,
  input: Omit<WorkoutResultInput, 'memberId'> & { memberId?: string | undefined },
): Promise<{ result: ResultRow; isPersonalRecord: boolean }> {
  const { component, workout } = await scorableComponent(context, input.componentId);
  if (component.scoreType === 'none') throw unprocessable('component_not_scored');
  if (missingScoreFields(component.scoreType, input).length > 0) {
    throw unprocessable('score_incomplete');
  }
  const member = await resolveMember(context, input.memberId);
  const values = {
    ...scoreFor(component, input),
    scaling: input.scaling,
    notes: input.notes,
  };
  const [result] = await context.transaction
    .insert(workoutResults)
    .values({
      ...values,
      boxId: context.auth.boxId,
      componentId: component.id,
      memberId: member.id,
    })
    .onConflictDoUpdate({
      target: [workoutResults.componentId, workoutResults.memberId],
      set: values,
    })
    .returning();
  if (!result) throw new Error('Result was not saved');
  const isPersonalRecord = await recordPersonalBest(
    context,
    component,
    result,
    workout.workoutDate,
  );
  return { result, isPersonalRecord };
}

export async function deleteOwnResult(context: ServiceContext, resultId: string): Promise<void> {
  const own = await getOwnMember(context);
  const deleted = await context.transaction
    .delete(workoutResults)
    .where(and(eq(workoutResults.id, resultId), eq(workoutResults.memberId, own.id)))
    .returning({ id: workoutResults.id });
  if (deleted.length === 0) throw notFound('result');
}

type LeaderboardEntry = ResultRow & {
  firstName: string;
  lastName: string;
  fistBumps: number;
  bumpedByMe: boolean;
};

/** Lower is better only for times; Rx always ranks above scaled. */
function compareScores(scoreType: ScoreType) {
  const value = (entry: LeaderboardEntry): number => {
    switch (scoreType) {
      case 'time':
        return -(entry.timeSeconds ?? Number.MAX_SAFE_INTEGER);
      case 'rounds_reps':
        return (entry.rounds ?? 0) * 10_000 + (entry.reps ?? 0);
      case 'reps':
        return entry.reps ?? 0;
      case 'load':
        return entry.loadGrams ?? 0;
      case 'distance':
        return entry.distanceMeters ?? 0;
      case 'calories':
        return entry.calories ?? 0;
      case 'points':
        return entry.points ?? 0;
      case 'none':
        return 0;
    }
  };
  return (first: LeaderboardEntry, second: LeaderboardEntry) =>
    (first.scaling === 'rx' ? 0 : 1) - (second.scaling === 'rx' ? 0 : 1) ||
    value(second) - value(first);
}

/** The day's whiteboard for one component, best first, with fist bumps. */
export async function leaderboard(context: ServiceContext, componentId: string) {
  const { component } = await scorableComponent(context, componentId);
  const rows = await context.transaction
    .select({ result: workoutResults, firstName: members.firstName, lastName: members.lastName })
    .from(workoutResults)
    .innerJoin(members, eq(members.id, workoutResults.memberId))
    .where(eq(workoutResults.componentId, componentId))
    .orderBy(asc(workoutResults.createdAt));
  const resultIds = rows.map((row) => row.result.id);
  const bumps = rows.length
    ? await context.transaction
        .select({ resultId: resultFistBumps.resultId, total: count() })
        .from(resultFistBumps)
        .where(inArray(resultFistBumps.resultId, resultIds))
        .groupBy(resultFistBumps.resultId)
    : [];
  // Lets the app paint the member's own fist bumps as given after a reload.
  const ownBumps =
    rows.length && !isStaff(context.auth.role)
      ? await context.transaction
          .select({ resultId: resultFistBumps.resultId })
          .from(resultFistBumps)
          .where(
            and(
              inArray(resultFistBumps.resultId, resultIds),
              eq(resultFistBumps.memberId, (await getOwnMember(context)).id),
            ),
          )
      : [];
  // A result's notes are private to its owner (and staff); the rest of the box sees the score.
  const ownMemberId = isStaff(context.auth.role) ? null : (await getOwnMember(context)).id;
  const entries = rows.map(({ result, firstName, lastName }) => ({
    ...result,
    notes: ownMemberId === null || result.memberId === ownMemberId ? result.notes : null,
    firstName,
    lastName,
    fistBumps: bumps.find((bump) => bump.resultId === result.id)?.total ?? 0,
    bumpedByMe: ownBumps.some((bump) => bump.resultId === result.id),
  }));
  return { component, entries: entries.sort(compareScores(component.scoreType)) };
}

/** Gives or takes back a fist bump on someone else's result. */
export async function toggleFistBump(context: ServiceContext, resultId: string) {
  const own = await getOwnMember(context);
  const [result] = await context.transaction
    .select()
    .from(workoutResults)
    .where(eq(workoutResults.id, resultId));
  if (!result) throw notFound('result');
  await scorableComponent(context, result.componentId);
  if (result.memberId === own.id) throw unprocessable('cannot_bump_own_result');
  const removed = await context.transaction
    .delete(resultFistBumps)
    .where(and(eq(resultFistBumps.resultId, resultId), eq(resultFistBumps.memberId, own.id)))
    .returning({ id: resultFistBumps.id });
  if (removed.length > 0) return { bumped: false };
  await context.transaction
    .insert(resultFistBumps)
    .values({ boxId: context.auth.boxId, resultId, memberId: own.id });
  return { bumped: true };
}

/** A member's personal records, newest first. */
export async function listPersonalRecords(context: ServiceContext, memberId: string) {
  const member = await getMember(context, memberId);
  return context.transaction
    .select()
    .from(personalRecords)
    .where(eq(personalRecords.memberId, member.id))
    .orderBy(desc(personalRecords.achievedOn));
}

export async function listOwnPersonalRecords(context: ServiceContext) {
  return listPersonalRecords(context, (await getOwnMember(context)).id);
}
