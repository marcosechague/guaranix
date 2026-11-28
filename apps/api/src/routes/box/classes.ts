import {
  attendanceSchema,
  cancelClassSchema,
  classScheduleSchema,
  createProgramSchema,
  endScheduleSchema,
  generateClassesSchema,
  listClassesQuerySchema,
  updateClassSessionSchema,
  updateProgramSchema,
  updateScheduleSchema,
  walkInSchema,
} from '@guaranix/shared';
import { createBoxRouter } from '../../middleware/box-scope';
import { idParam, parseBody, parseQuery, respond } from '../../lib/service-route';
import { addWalkIn, takeAttendance } from '../../services/coach-attendance';
import { cancelClass, getClassRoster, listClasses, updateClass } from '../../services/classes';
import { updateSchedule } from '../../services/schedule-updates';
import { createProgram, listPrograms, updateProgram } from '../../services/programs';
import {
  createSchedule,
  endSchedule,
  generateClasses,
  listSchedules,
} from '../../services/schedules';
import { ANY_ROLE, MANAGERS, STAFF } from './roles';

const programs = createBoxRouter();

programs.get('/', ANY_ROLE, (context) =>
  respond(context, async (service) => ({ programs: await listPrograms(service) })),
);

programs.post('/', MANAGERS, (context) =>
  respond(
    context,
    async (service) => ({
      program: await createProgram(service, await parseBody(context, createProgramSchema)),
    }),
    201,
  ),
);

programs.patch('/:programId', MANAGERS, (context) =>
  respond(context, async (service) => {
    const programId = idParam(context, 'programId', 'program');
    const input = await parseBody(context, updateProgramSchema);
    return { program: await updateProgram(service, programId, input) };
  }),
);

export const programRoutes = programs.router;

const schedules = createBoxRouter();

schedules.get('/', STAFF, (context) =>
  respond(context, async (service) => ({ schedules: await listSchedules(service) })),
);

schedules.post('/', MANAGERS, (context) =>
  respond(
    context,
    async (service) => ({
      schedule: await createSchedule(service, await parseBody(context, classScheduleSchema)),
    }),
    201,
  ),
);

schedules.post('/:scheduleId/end', MANAGERS, (context) =>
  respond(context, async (service) => {
    const scheduleId = idParam(context, 'scheduleId', 'schedule');
    const { lastDate } = await parseBody(context, endScheduleSchema);
    return { schedule: await endSchedule(service, scheduleId, lastDate) };
  }),
);

schedules.patch('/:scheduleId', MANAGERS, (context) =>
  respond(context, async (service) => {
    const scheduleId = idParam(context, 'scheduleId', 'schedule');
    const input = await parseBody(context, updateScheduleSchema);
    return updateSchedule(service, scheduleId, input);
  }),
);

export const scheduleRoutes = schedules.router;

const classes = createBoxRouter();

classes.get('/', ANY_ROLE, (context) =>
  respond(context, async (service) => ({
    classes: await listClasses(service, parseQuery(context, listClassesQuerySchema)),
  })),
);

classes.post('/generate', MANAGERS, (context) =>
  respond(context, async (service) =>
    generateClasses(service, await parseBody(context, generateClassesSchema)),
  ),
);

classes.get('/:classId/roster', STAFF, (context) =>
  respond(context, async (service) =>
    getClassRoster(service, idParam(context, 'classId', 'class')),
  ),
);

classes.patch('/:classId', MANAGERS, (context) =>
  respond(context, async (service) => {
    const classId = idParam(context, 'classId', 'class');
    return updateClass(service, classId, await parseBody(context, updateClassSessionSchema));
  }),
);

classes.post('/:classId/cancel', MANAGERS, (context) =>
  respond(context, async (service) => {
    const classId = idParam(context, 'classId', 'class');
    const { reason } = await parseBody(context, cancelClassSchema);
    return cancelClass(service, classId, reason);
  }),
);

classes.post('/:classId/attendance', STAFF, (context) =>
  respond(context, async (service) => {
    const classId = idParam(context, 'classId', 'class');
    const { entries } = await parseBody(context, attendanceSchema);
    return { bookings: await takeAttendance(service, classId, entries) };
  }),
);

classes.post('/:classId/walk-ins', STAFF, (context) =>
  respond(context, async (service) => {
    const classId = idParam(context, 'classId', 'class');
    const { memberId } = await parseBody(context, walkInSchema);
    return { result: await addWalkIn(service, classId, memberId) };
  }),
);

export const classRoutes = classes.router;
