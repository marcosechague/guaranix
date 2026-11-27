import {
  createWorkoutSchema,
  listWorkoutsQuerySchema,
  logResultSchema,
  movementSchema,
} from '@guaranix/shared';
import { createBoxRouter } from '../../middleware/box-scope';
import { idParam, parseBody, parseQuery, respond } from '../../lib/service-route';
import {
  deleteOwnResult,
  leaderboard,
  logResult,
  toggleFistBump,
} from '../../services/workout-results';
import {
  createMovement,
  createWorkout,
  deleteWorkout,
  getWorkout,
  listMovements,
  listWorkouts,
  setWorkoutPublished,
  updateWorkout,
} from '../../services/workouts';
import { ANY_ROLE, COACHING, MEMBERS_ONLY } from './roles';

const movements = createBoxRouter();

movements.get('/', ANY_ROLE, (context) =>
  respond(context, async (service) => ({ movements: await listMovements(service) })),
);

movements.post('/', COACHING, (context) =>
  respond(
    context,
    async (service) => ({
      movement: await createMovement(service, await parseBody(context, movementSchema)),
    }),
    201,
  ),
);

export const movementRoutes = movements.router;

const workouts = createBoxRouter();

workouts.get('/', ANY_ROLE, (context) =>
  respond(context, async (service) => ({
    workouts: await listWorkouts(service, parseQuery(context, listWorkoutsQuerySchema)),
  })),
);

workouts.get('/:workoutId', ANY_ROLE, (context) =>
  respond(context, async (service) => ({
    workout: await getWorkout(service, idParam(context, 'workoutId', 'workout')),
  })),
);

workouts.post('/', COACHING, (context) =>
  respond(
    context,
    async (service) => ({
      workout: await createWorkout(service, await parseBody(context, createWorkoutSchema)),
    }),
    201,
  ),
);

workouts.patch('/:workoutId', COACHING, (context) =>
  respond(context, async (service) => {
    const workoutId = idParam(context, 'workoutId', 'workout');
    const input = await parseBody(context, createWorkoutSchema);
    return { workout: await updateWorkout(service, workoutId, input) };
  }),
);

for (const [path, published] of [
  ['/:workoutId/publish', true],
  ['/:workoutId/unpublish', false],
] as const) {
  workouts.post(path, COACHING, (context) =>
    respond(context, async (service) => ({
      workout: await setWorkoutPublished(
        service,
        idParam(context, 'workoutId', 'workout'),
        published,
      ),
    })),
  );
}

workouts.delete('/:workoutId', COACHING, (context) =>
  respond(context, async (service) => {
    await deleteWorkout(service, idParam(context, 'workoutId', 'workout'));
    return { deleted: true };
  }),
);

export const workoutRoutes = workouts.router;

const results = createBoxRouter();

results.post('/', ANY_ROLE, (context) =>
  respond(
    context,
    async (service) => logResult(service, await parseBody(context, logResultSchema)),
    201,
  ),
);

results.delete('/:resultId', MEMBERS_ONLY, (context) =>
  respond(context, async (service) => {
    await deleteOwnResult(service, idParam(context, 'resultId', 'result'));
    return { deleted: true };
  }),
);

results.post('/:resultId/fist-bump', MEMBERS_ONLY, (context) =>
  respond(context, async (service) =>
    toggleFistBump(service, idParam(context, 'resultId', 'result')),
  ),
);

export const resultRoutes = results.router;

const components = createBoxRouter();

components.get('/:componentId/leaderboard', ANY_ROLE, (context) =>
  respond(context, async (service) =>
    leaderboard(service, idParam(context, 'componentId', 'component')),
  ),
);

export const componentRoutes = components.router;
