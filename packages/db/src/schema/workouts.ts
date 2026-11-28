import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { programs } from './classes';
import {
  movementCategoryEnum,
  scalingEnum,
  scoreTypeEnum,
  timerTypeEnum,
  workoutComponentKindEnum,
} from './enums';
import { boxUsers, members } from './people';
import { sameBoxReference, tenantColumns, tenantIsolationPolicy, tenantKey } from './tenant';

/** Movement library (Back Squat, Clean…), used for PRs and strength components. */
export const movements = pgTable(
  'movements',
  {
    ...tenantColumns(),
    name: text().notNull(),
    category: movementCategoryEnum().notNull(),
  },
  (table) => [
    tenantKey('movements', table.boxId, table.id),
    unique('movements_box_id_name_unique').on(table.boxId, table.name),
    tenantIsolationPolicy(table.boxId),
  ],
);

/** The WOD of a program for one day. Hidden from members until published. */
export const workouts = pgTable(
  'workouts',
  {
    ...tenantColumns(),
    programId: uuid().notNull(),
    workoutDate: date().notNull(),
    title: text(),
    coachNotes: text(),
    publishedAt: timestamp({ withTimezone: true }),
    createdByUserId: uuid(),
  },
  (table) => [
    tenantKey('workouts', table.boxId, table.id),
    sameBoxReference(
      'workouts_program_fk',
      [table.boxId, table.programId],
      [programs.boxId, programs.id],
    ),
    sameBoxReference(
      'workouts_created_by_fk',
      [table.boxId, table.createdByUserId],
      [boxUsers.boxId, boxUsers.userId],
    ),
    index('workouts_box_id_workout_date_idx').on(table.boxId, table.workoutDate),
    tenantIsolationPolicy(table.boxId),
  ],
);

/** One block of a WOD (warm-up, strength, metcon…) with its timer and score type. */
export const workoutComponents = pgTable(
  'workout_components',
  {
    ...tenantColumns(),
    workoutId: uuid().notNull(),
    position: smallint().notNull(),
    kind: workoutComponentKindEnum().notNull(),
    title: text(),
    description: text().notNull(),
    scoreType: scoreTypeEnum().notNull().default('none'),
    timerType: timerTypeEnum().notNull().default('none'),
    timeCapSeconds: integer(),
    rounds: integer(),
    intervalSeconds: integer(),
    workSeconds: integer(),
    restSeconds: integer(),
    movementId: uuid(),
    /** Steps of the guided mode ({ quantity, name }[]); null reads them from the description. */
    guidedSteps: jsonb().$type<{ quantity: string; name: string }[]>(),
    /** Suggested load as a % of the member's best on `movement_id`. */
    loadPercent: smallint(),
  },
  (table) => [
    tenantKey('workout_components', table.boxId, table.id),
    sameBoxReference(
      'workout_components_workout_fk',
      [table.boxId, table.workoutId],
      [workouts.boxId, workouts.id],
    ),
    sameBoxReference(
      'workout_components_movement_fk',
      [table.boxId, table.movementId],
      [movements.boxId, movements.id],
    ),
    unique('workout_components_workout_id_position_unique').on(table.workoutId, table.position),
    check(
      'workout_components_timer_config',
      sql`case ${table.timerType}
        when 'amrap' then ${table.timeCapSeconds} is not null
        when 'emom' then ${table.intervalSeconds} is not null and ${table.rounds} is not null
        when 'tabata' then ${table.workSeconds} is not null and ${table.restSeconds} is not null and ${table.rounds} is not null
        else true
      end`,
    ),
    check(
      'workout_components_load_percent',
      sql`${table.loadPercent} is null or (${table.loadPercent} between 1 and 150 and ${table.movementId} is not null)`,
    ),
    tenantIsolationPolicy(table.boxId),
  ],
);

/**
 * A member's score on one component. Loads are stored in grams so that
 * 62.5 kg stays an integer; the score columns used depend on `score_type`.
 */
export const workoutResults = pgTable(
  'workout_results',
  {
    ...tenantColumns(),
    componentId: uuid().notNull(),
    memberId: uuid().notNull(),
    scaling: scalingEnum().notNull(),
    timeSeconds: integer(),
    rounds: integer(),
    reps: integer(),
    loadGrams: integer(),
    distanceMeters: integer(),
    calories: integer(),
    points: integer(),
    notes: text(),
  },
  (table) => [
    tenantKey('workout_results', table.boxId, table.id),
    sameBoxReference(
      'workout_results_component_fk',
      [table.boxId, table.componentId],
      [workoutComponents.boxId, workoutComponents.id],
    ),
    sameBoxReference(
      'workout_results_member_fk',
      [table.boxId, table.memberId],
      [members.boxId, members.id],
    ),
    unique('workout_results_component_id_member_id_unique').on(table.componentId, table.memberId),
    index('workout_results_box_id_member_id_idx').on(table.boxId, table.memberId),
    tenantIsolationPolicy(table.boxId),
  ],
);

/** "Fist bumps" on the day's leaderboard. */
export const resultFistBumps = pgTable(
  'result_fist_bumps',
  {
    ...tenantColumns(),
    resultId: uuid().notNull(),
    memberId: uuid().notNull(),
  },
  (table) => [
    sameBoxReference(
      'result_fist_bumps_result_fk',
      [table.boxId, table.resultId],
      [workoutResults.boxId, workoutResults.id],
    ),
    sameBoxReference(
      'result_fist_bumps_member_fk',
      [table.boxId, table.memberId],
      [members.boxId, members.id],
    ),
    unique('result_fist_bumps_result_id_member_id_unique').on(table.resultId, table.memberId),
    tenantIsolationPolicy(table.boxId),
  ],
);

/** Best marks per movement (1RM, 3RM, fastest time…). */
export const personalRecords = pgTable(
  'personal_records',
  {
    ...tenantColumns(),
    memberId: uuid().notNull(),
    movementId: uuid().notNull(),
    repMax: smallint(),
    loadGrams: integer(),
    timeSeconds: integer(),
    reps: integer(),
    achievedOn: date().notNull(),
    resultId: uuid(),
  },
  (table) => [
    sameBoxReference(
      'personal_records_member_fk',
      [table.boxId, table.memberId],
      [members.boxId, members.id],
    ),
    sameBoxReference(
      'personal_records_movement_fk',
      [table.boxId, table.movementId],
      [movements.boxId, movements.id],
    ),
    sameBoxReference(
      'personal_records_result_fk',
      [table.boxId, table.resultId],
      [workoutResults.boxId, workoutResults.id],
    ),
    index('personal_records_box_id_member_id_movement_id_idx').on(
      table.boxId,
      table.memberId,
      table.movementId,
    ),
    check(
      'personal_records_has_value',
      sql`${table.loadGrams} is not null or ${table.timeSeconds} is not null or ${table.reps} is not null`,
    ),
    tenantIsolationPolicy(table.boxId),
  ],
);
