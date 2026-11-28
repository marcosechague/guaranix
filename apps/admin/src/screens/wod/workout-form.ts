import { createWorkoutSchema, type CreateWorkoutInput } from '@guaranix/shared/schemas';
import type { Workout } from '@guaranix/shared/api';
import type { ScoreType, TimerType, WorkoutComponentKind } from '@guaranix/shared/domain';

/** Text inputs hold strings; numbers are parsed on submit so empty fields mean "not set". */
export interface ComponentFormValues {
  kind: WorkoutComponentKind;
  title: string;
  description: string;
  scoreType: ScoreType;
  timerType: TimerType;
  timeCapMinutes: string;
  rounds: string;
  intervalSeconds: string;
  workSeconds: string;
  restSeconds: string;
  movementId: string;
  /** Empty means the guided mode reads the steps from the description. */
  guidedSteps: { quantity: string; name: string }[];
  loadPercent: string;
}

export interface WorkoutFormValues {
  title: string;
  coachNotes: string;
  components: ComponentFormValues[];
}

export function blankComponent(kind: WorkoutComponentKind = 'metcon'): ComponentFormValues {
  return {
    kind,
    title: '',
    description: '',
    scoreType: kind === 'metcon' ? 'time' : kind === 'strength' ? 'load' : 'none',
    timerType: kind === 'metcon' ? 'for_time' : 'none',
    timeCapMinutes: '',
    rounds: '',
    intervalSeconds: '',
    workSeconds: '',
    restSeconds: '',
    movementId: '',
    guidedSteps: [],
    loadPercent: '',
  };
}

const text = (value: number | null) => (value === null ? '' : String(value));

export function toFormValues(workout: Workout | undefined): WorkoutFormValues {
  if (!workout) return { title: '', coachNotes: '', components: [blankComponent()] };
  return {
    title: workout.title ?? '',
    coachNotes: workout.coachNotes ?? '',
    components: [...workout.components]
      .sort((a, b) => a.position - b.position)
      .map((component) => ({
        kind: component.kind,
        title: component.title ?? '',
        description: component.description,
        scoreType: component.scoreType,
        timerType: component.timerType,
        timeCapMinutes:
          component.timeCapSeconds === null ? '' : String(component.timeCapSeconds / 60),
        rounds: text(component.rounds),
        intervalSeconds: text(component.intervalSeconds),
        workSeconds: text(component.workSeconds),
        restSeconds: text(component.restSeconds),
        movementId: component.movementId ?? '',
        guidedSteps: component.guidedSteps ?? [],
        loadPercent: text(component.loadPercent),
      })),
  };
}

const integerOrNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed === '' ? null : Number(trimmed);
};

/** Blank rows are dropped; no rows left means "read them from the description". */
function guidedStepsInput(steps: ComponentFormValues['guidedSteps']) {
  const filled = steps
    .map((step) => ({ quantity: step.quantity.trim(), name: step.name.trim() }))
    .filter((step) => step.name !== '');
  return filled.length > 0 ? filled : null;
}

/** Builds the API payload; returns the schema's issues so the form can point at each field. */
export function toWorkoutInput(
  values: WorkoutFormValues,
  context: { programId: string; workoutDate: string },
) {
  const input: CreateWorkoutInput = {
    ...context,
    title: values.title.trim() || null,
    coachNotes: values.coachNotes.trim() || null,
    components: values.components.map((component, position) => {
      const minutes = integerOrNull(component.timeCapMinutes);
      return {
        position,
        kind: component.kind,
        title: component.title.trim() || null,
        description: component.description,
        scoreType: component.scoreType,
        timerType: component.timerType,
        timeCapSeconds: minutes === null ? null : Math.round(minutes * 60),
        rounds: integerOrNull(component.rounds),
        intervalSeconds: integerOrNull(component.intervalSeconds),
        workSeconds: integerOrNull(component.workSeconds),
        restSeconds: integerOrNull(component.restSeconds),
        movementId: component.movementId || null,
        guidedSteps: guidedStepsInput(component.guidedSteps),
        loadPercent: component.movementId ? integerOrNull(component.loadPercent) : null,
      };
    }),
  };
  return createWorkoutSchema.safeParse(input);
}

const FORM_FIELD: Record<string, keyof ComponentFormValues> = {
  timeCapSeconds: 'timeCapMinutes',
  rounds: 'rounds',
  intervalSeconds: 'intervalSeconds',
  workSeconds: 'workSeconds',
  restSeconds: 'restSeconds',
  loadPercent: 'loadPercent',
  movementId: 'movementId',
  description: 'description',
  title: 'title',
};

/** Maps a schema issue path (`components.0.timeCapSeconds`) to the form field that holds it. */
export function formFieldOf(path: readonly PropertyKey[]): string | null {
  const [root, index, field] = path;
  if (root === 'components' && typeof index === 'number' && typeof field === 'string') {
    const formField = FORM_FIELD[field];
    return formField ? `components.${index}.${formField}` : null;
  }
  if (root === 'title' || root === 'coachNotes') return root;
  return null;
}
