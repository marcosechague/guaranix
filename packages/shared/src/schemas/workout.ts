import { z } from 'zod';
import {
  MOVEMENT_CATEGORIES,
  SCALINGS,
  SCORE_TYPES,
  TIMER_TYPES,
  WORKOUT_COMPONENT_KINDS,
  type ScoreType,
} from '../domain/enums';
import { calendarDateSchema, idSchema, nameSchema } from './common';

const secondsSchema = z
  .number()
  .int()
  .min(1)
  .max(6 * 60 * 60);
const countSchema = z.number().int().min(0).max(100_000);

export const movementSchema = z.object({
  name: nameSchema,
  category: z.enum(MOVEMENT_CATEGORIES),
});

export const workoutComponentSchema = z
  .object({
    position: z.number().int().min(0).max(50),
    kind: z.enum(WORKOUT_COMPONENT_KINDS),
    title: z.string().trim().max(120).nullable().default(null),
    description: z.string().trim().min(1).max(5000),
    scoreType: z.enum(SCORE_TYPES).default('none'),
    timerType: z.enum(TIMER_TYPES).default('none'),
    timeCapSeconds: secondsSchema.nullable().default(null),
    rounds: z.number().int().min(1).max(200).nullable().default(null),
    intervalSeconds: secondsSchema.nullable().default(null),
    workSeconds: secondsSchema.nullable().default(null),
    restSeconds: z.number().int().min(0).max(3600).nullable().default(null),
    movementId: idSchema.nullable().default(null),
  })
  .superRefine((component, context) => {
    const require = (field: keyof typeof component, message: string) => {
      if (component[field] === null) context.addIssue({ code: 'custom', path: [field], message });
    };
    if (component.timerType === 'amrap') require('timeCapSeconds', 'AMRAP needs a duration');
    if (component.timerType === 'emom') {
      require('intervalSeconds', 'EMOM needs an interval');
      require('rounds', 'EMOM needs a number of rounds');
    }
    if (component.timerType === 'tabata') {
      require('workSeconds', 'Tabata needs work seconds');
      require('restSeconds', 'Tabata needs rest seconds');
      require('rounds', 'Tabata needs a number of rounds');
    }
  });

export const createWorkoutSchema = z.object({
  programId: idSchema,
  workoutDate: calendarDateSchema,
  title: z.string().trim().max(120).nullable().default(null),
  coachNotes: z.string().trim().max(5000).nullable().default(null),
  components: z.array(workoutComponentSchema).min(1).max(20),
});

const scoreFields = {
  timeSeconds: secondsSchema.nullable().default(null),
  rounds: countSchema.nullable().default(null),
  reps: countSchema.nullable().default(null),
  loadGrams: z.number().int().min(0).max(1_000_000).nullable().default(null),
  distanceMeters: countSchema.nullable().default(null),
  calories: countSchema.nullable().default(null),
  points: countSchema.nullable().default(null),
};

type ScoreField = keyof typeof scoreFields;

/** Which score columns a result must fill for each score type. */
export const REQUIRED_SCORE_FIELDS: Record<ScoreType, readonly ScoreField[]> = {
  none: [],
  time: ['timeSeconds'],
  rounds_reps: ['rounds', 'reps'],
  reps: ['reps'],
  load: ['loadGrams'],
  distance: ['distanceMeters'],
  calories: ['calories'],
  points: ['points'],
};

export const workoutResultSchema = z.object({
  componentId: idSchema,
  memberId: idSchema,
  scaling: z.enum(SCALINGS),
  notes: z.string().trim().max(1000).nullable().default(null),
  ...scoreFields,
});

export type WorkoutResultInput = z.output<typeof workoutResultSchema>;

/** Results are validated against the component they belong to, which the API loads. */
export function missingScoreFields(
  scoreType: ScoreType,
  result: Pick<WorkoutResultInput, ScoreField>,
): ScoreField[] {
  return REQUIRED_SCORE_FIELDS[scoreType].filter((field) => result[field] === null);
}

export const personalRecordSchema = z
  .object({
    memberId: idSchema,
    movementId: idSchema,
    /** 1 for a 1RM, 3 for a 3RM… null for non-load records. */
    repMax: z.number().int().min(1).max(20).nullable().default(null),
    loadGrams: scoreFields.loadGrams,
    timeSeconds: scoreFields.timeSeconds,
    reps: scoreFields.reps,
    achievedOn: calendarDateSchema,
    resultId: idSchema.nullable().default(null),
  })
  .refine(
    (record) => record.loadGrams !== null || record.timeSeconds !== null || record.reps !== null,
    { error: 'A record needs a load, a time or reps', path: ['loadGrams'] },
  );

export type MovementInput = z.infer<typeof movementSchema>;
export type WorkoutComponentInput = z.input<typeof workoutComponentSchema>;
export type CreateWorkoutInput = z.input<typeof createWorkoutSchema>;
export type PersonalRecordInput = z.input<typeof personalRecordSchema>;
