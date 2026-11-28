import { eq } from 'drizzle-orm';
import { movements, personalRecords } from '@guaranix/db/schema';
import { createWorkoutSchema } from '@guaranix/shared/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookingWorld } from '../testing/booking-helpers';
import { expectServiceError } from '../testing/expectations';
import { createServiceFixture, type ServiceFixture } from '../testing/service-fixture';
import { deleteOwnResult, leaderboard, logResult, toggleFistBump } from './workout-results';
import {
  createWorkout,
  deleteWorkout,
  getWorkout,
  listWorkouts,
  setWorkoutPublished,
  updateWorkout,
} from './workouts';

let fixture: ServiceFixture;
let world: ReturnType<typeof bookingWorld>;
let programId: string;
let backSquatId: string;
let dayCounter = 0;

beforeAll(async () => {
  fixture = await createServiceFixture();
  world = bookingWorld(fixture, fixture.boxA);
  programId = await world.programId();
  const rows = await fixture.system((transaction) =>
    transaction.select().from(movements).where(eq(movements.boxId, fixture.boxA.boxId)),
  );
  backSquatId = rows.find((row) => row.name === 'Back Squat')?.id ?? '';
});

afterAll(async () => {
  await fixture.close();
});

function wodInput() {
  dayCounter += 1;
  return createWorkoutSchema.parse({
    programId,
    workoutDate: `2031-04-${String(dayCounter).padStart(2, '0')}`,
    title: 'Fran',
    components: [
      {
        position: 0,
        kind: 'strength',
        description: 'Back Squat 5x5',
        scoreType: 'load',
        movementId: backSquatId,
      },
      {
        position: 1,
        kind: 'metcon',
        description: '21-15-9 Thrusters, Pull-ups',
        scoreType: 'time',
        timerType: 'for_time',
        timeCapSeconds: 600,
      },
      { position: 2, kind: 'warm_up', description: '10 min movilidad' },
    ],
  });
}

async function publishedWod() {
  const draft = await world.as('coach', (context) => createWorkout(context, wodInput()));
  return world.as('coach', (context) => setWorkoutPublished(context, draft.id, true));
}

describe('WODs', () => {
  it('coaches create drafts that members cannot see until published', async () => {
    const draft = await world.as('coach', (context) => createWorkout(context, wodInput()));
    expect(draft.components.map((component) => component.kind)).toEqual([
      'strength',
      'metcon',
      'warm_up',
    ]);
    const member = await world.memberWith();
    expect(
      await member.act((context) => listWorkouts(context, { date: draft.workoutDate })),
    ).toEqual([]);
    await expectServiceError(
      member.act((context) => getWorkout(context, draft.id)),
      'workout_not_found',
    );
    await world.as('coach', (context) => setWorkoutPublished(context, draft.id, true));
    const visible = await member.act((context) =>
      listWorkouts(context, { date: draft.workoutDate }),
    );
    expect(visible.map((workout) => workout.id)).toEqual([draft.id]);
  });

  it('keeps coach notes away from members', async () => {
    const draft = await world.as('coach', (context) =>
      createWorkout(context, { ...wodInput(), coachNotes: 'Escalar a Rosa' }),
    );
    await world.as('coach', (context) => setWorkoutPublished(context, draft.id, true));
    const member = await world.memberWith();
    const [listed] = await member.act((context) =>
      listWorkouts(context, { date: draft.workoutDate }),
    );
    expect(listed?.coachNotes).toBeNull();
    expect((await member.act((context) => getWorkout(context, draft.id))).coachNotes).toBeNull();
    expect((await world.as('coach', (context) => getWorkout(context, draft.id))).coachNotes).toBe(
      'Escalar a Rosa',
    );
  });

  it('allows one WOD per program and day', async () => {
    const input = wodInput();
    await world.as('coach', (context) => createWorkout(context, input));
    await expectServiceError(
      world.as('box_owner', (context) => createWorkout(context, input)),
      'workout_exists',
    );
  });

  it('only coaching roles program WODs', async () => {
    for (const role of ['reception', 'member'] as const) {
      await expectServiceError(
        world.as(role, (context) => createWorkout(context, wodInput())),
        'forbidden',
      );
    }
  });

  it('locks the structure once there are results', async () => {
    const wod = await publishedWod();
    const member = await world.memberWith();
    await member.act((context) =>
      logResult(context, {
        ...empty,
        componentId: wod.components[1]?.id ?? '',
        scaling: 'rx',
        timeSeconds: 300,
      }),
    );
    await expectServiceError(
      world.as('coach', (context) =>
        updateWorkout(context, wod.id, { ...wodInput(), workoutDate: wod.workoutDate }),
      ),
      'workout_has_results',
    );
    await expectServiceError(
      world.as('coach', (context) => deleteWorkout(context, wod.id)),
      'workout_has_results',
    );
  });

  it("can't use another box's program or movements", async () => {
    const other = bookingWorld(fixture, fixture.boxB);
    await expectServiceError(
      other.as('box_owner', (context) => createWorkout(context, wodInput())),
      'program_not_found',
    );
    const foreignProgram = await other.programId();
    await expectServiceError(
      other.as('box_owner', (context) =>
        createWorkout(context, { ...wodInput(), programId: foreignProgram }),
      ),
      'movement_not_found',
    );
  });
});

const empty = {
  timeSeconds: null,
  rounds: null,
  reps: null,
  loadGrams: null,
  distanceMeters: null,
  calories: null,
  points: null,
  notes: null,
};

describe('results', () => {
  it('validates the score against the component and corrects instead of duplicating', async () => {
    const wod = await publishedWod();
    const [strength, metcon, warmUp] = wod.components;
    const member = await world.memberWith();
    await expectServiceError(
      member.act((context) =>
        logResult(context, { ...empty, componentId: metcon?.id ?? '', scaling: 'rx' }),
      ),
      'score_incomplete',
    );
    await expectServiceError(
      member.act((context) =>
        logResult(context, { ...empty, componentId: warmUp?.id ?? '', scaling: 'rx' }),
      ),
      'component_not_scored',
    );
    const first = await member.act((context) =>
      logResult(context, {
        ...empty,
        componentId: metcon?.id ?? '',
        scaling: 'rx',
        timeSeconds: 400,
        loadGrams: 5,
      }),
    );
    expect(first.result.loadGrams).toBeNull();
    const corrected = await member.act((context) =>
      logResult(context, {
        ...empty,
        componentId: metcon?.id ?? '',
        scaling: 'scaled',
        timeSeconds: 380,
      }),
    );
    expect(corrected.result.id).toBe(first.result.id);
    expect(corrected.result).toMatchObject({ timeSeconds: 380, scaling: 'scaled' });
    expect(strength).toBeDefined();
  });

  it('detects personal records on load components', async () => {
    const member = await world.memberWith();
    const squat = async (loadGrams: number) => {
      const wod = await publishedWod();
      return member.act((context) =>
        logResult(context, {
          ...empty,
          componentId: wod.components[0]?.id ?? '',
          scaling: 'rx',
          loadGrams,
        }),
      );
    };
    expect((await squat(100_000)).isPersonalRecord).toBe(true);
    expect((await squat(95_000)).isPersonalRecord).toBe(false);
    expect((await squat(102_500)).isPersonalRecord).toBe(true);
    const records = await fixture.system((transaction) =>
      transaction
        .select()
        .from(personalRecords)
        .where(eq(personalRecords.memberId, member.member.id)),
    );
    expect(records.map((record) => record.loadGrams).sort()).toEqual([100_000, 102_500]);
  });

  it('ranks Rx first, fastest time first, with fist bumps', async () => {
    const wod = await publishedWod();
    const metconId = wod.components[1]?.id ?? '';
    const fast = await world.memberWith();
    const slow = await world.memberWith();
    const scaled = await world.memberWith();
    const log = (who: typeof fast, scaling: 'rx' | 'scaled', timeSeconds: number) =>
      who.act((context) =>
        logResult(context, { ...empty, componentId: metconId, scaling, timeSeconds }),
      );
    await log(slow, 'rx', 500);
    await log(scaled, 'scaled', 200);
    const fastResult = await log(fast, 'rx', 300);
    expect(await slow.act((context) => toggleFistBump(context, fastResult.result.id))).toEqual({
      bumped: true,
    });
    const board = await slow.act((context) => leaderboard(context, metconId));
    expect(board.entries.map((entry) => [entry.memberId, entry.fistBumps])).toEqual([
      [fast.member.id, 1],
      [slow.member.id, 0],
      [scaled.member.id, 0],
    ]);
    expect(board.entries.map((entry) => entry.bumpedByMe)).toEqual([true, false, false]);
    await fast.act((context) =>
      logResult(context, {
        ...empty,
        componentId: metconId,
        scaling: 'rx',
        timeSeconds: 300,
        notes: 'Me dolió la rodilla',
      }),
    );
    const seenBySlow = await slow.act((context) => leaderboard(context, metconId));
    expect(seenBySlow.entries[0]?.notes).toBeNull();
    const seenByFast = await fast.act((context) => leaderboard(context, metconId));
    expect(seenByFast.entries[0]?.notes).toBe('Me dolió la rodilla');
    expect(await slow.act((context) => toggleFistBump(context, fastResult.result.id))).toEqual({
      bumped: false,
    });
    await expectServiceError(
      fast.act((context) => toggleFistBump(context, fastResult.result.id)),
      'cannot_bump_own_result',
    );
  });

  it('members log and delete only their own results; staff log for anyone', async () => {
    const wod = await publishedWod();
    const metconId = wod.components[1]?.id ?? '';
    const alice = await world.memberWith();
    const bruno = await world.memberWith();
    await expectServiceError(
      alice.act((context) =>
        logResult(context, {
          ...empty,
          componentId: metconId,
          scaling: 'rx',
          timeSeconds: 1,
          memberId: bruno.member.id,
        }),
      ),
      'member_not_found',
    );
    const byCoach = await world.as('coach', (context) =>
      logResult(context, {
        ...empty,
        componentId: metconId,
        scaling: 'rx',
        timeSeconds: 333,
        memberId: bruno.member.id,
      }),
    );
    await expectServiceError(
      alice.act((context) => deleteOwnResult(context, byCoach.result.id)),
      'result_not_found',
    );
    await bruno.act((context) => deleteOwnResult(context, byCoach.result.id));
  });

  it("another box can't see or score this box's WODs", async () => {
    const wod = await publishedWod();
    const other = bookingWorld(fixture, fixture.boxB);
    const foreigner = await other.memberWith();
    await expectServiceError(
      foreigner.act((context) =>
        logResult(context, {
          ...empty,
          componentId: wod.components[1]?.id ?? '',
          scaling: 'rx',
          timeSeconds: 1,
        }),
      ),
      'component_not_found',
    );
    await expectServiceError(
      other.as('coach', (context) => getWorkout(context, wod.id)),
      'workout_not_found',
    );
  });
});
