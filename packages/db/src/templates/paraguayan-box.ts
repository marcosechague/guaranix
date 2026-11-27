import type {
  ClassScheduleInput,
  CreatePlanInput,
  CreateProgramInput,
  MovementInput,
} from '@guaranix/shared/schemas';
import { classSchedules, movements, planPrograms, plans, programs } from '../schema';
import type { ScopedTransaction } from '../scope';

type ProgramKey = 'crossfit' | 'openBox';

export interface BoxTemplate {
  programs: Record<ProgramKey, Required<Pick<CreateProgramInput, 'name' | 'color'>>>;
  schedules: (Omit<ClassScheduleInput, 'programId' | 'validFrom'> & { program: ProgramKey })[];
  plans: (Omit<CreatePlanInput, 'programIds'> & { programs?: ProgramKey[] })[];
  movements: MovementInput[];
}

const WEEKDAYS = [1, 2, 3, 4, 5];

const weekdaySlots = (
  program: ProgramKey,
  times: string[],
  durationMinutes: number,
  capacity: number,
) =>
  WEEKDAYS.flatMap((weekday) =>
    times.map((startTime) => ({ program, weekday, startTime, durationMinutes, capacity })),
  );

/**
 * Typical box in Gran Asunción, offered at sign-up so a box is usable in minutes.
 * Names are seed data the box edits afterwards, not interface text. Prices are
 * reference values in guaraníes for late 2026 and should be reviewed with pilots.
 */
export const PARAGUAYAN_BOX_TEMPLATE: BoxTemplate = {
  programs: {
    crossfit: { name: 'CrossFit', color: '#D9F24A' },
    openBox: { name: 'Open Box', color: '#6EE7A0' },
  },
  schedules: [
    ...weekdaySlots('crossfit', ['06:00', '07:00', '08:00', '18:00', '19:00', '20:00'], 60, 16),
    ...[8, 9].map((hour) => ({
      program: 'crossfit' as const,
      weekday: 6,
      startTime: `0${hour}:00`,
      durationMinutes: 60,
      capacity: 20,
    })),
    ...weekdaySlots('openBox', ['09:00', '16:00'], 120, 10),
  ],
  plans: [
    { name: 'Ilimitado', kind: 'unlimited', priceGs: 350_000, durationDays: 30 },
    {
      name: '3 veces por semana',
      kind: 'weekly_limit',
      classesPerWeek: 3,
      priceGs: 280_000,
      durationDays: 30,
    },
    {
      name: '2 veces por semana',
      kind: 'weekly_limit',
      classesPerWeek: 2,
      priceGs: 230_000,
      durationDays: 30,
    },
    {
      name: 'Pack 10 clases',
      kind: 'class_pack',
      classCount: 10,
      priceGs: 300_000,
      durationDays: 60,
    },
    { name: 'Clase suelta', kind: 'drop_in', classCount: 1, priceGs: 50_000, durationDays: 7 },
    {
      name: 'Solo Open Box',
      kind: 'unlimited',
      priceGs: 200_000,
      durationDays: 30,
      programs: ['openBox'],
    },
  ],
  movements: [
    ...['Back Squat', 'Front Squat', 'Overhead Squat', 'Deadlift', 'Clean', 'Power Clean']
      .concat(['Snatch', 'Power Snatch', 'Clean & Jerk', 'Push Press', 'Strict Press'])
      .concat(['Push Jerk', 'Thruster', 'Bench Press'])
      .map((name) => ({ name, category: 'weightlifting' as const })),
    ...['Pull-up', 'Chest to Bar', 'Muscle-up', 'Handstand Push-up', 'Toes to Bar']
      .concat(['Double Under', 'Burpee', 'Box Jump', 'Wall Ball'])
      .map((name) => ({ name, category: 'gymnastics' as const })),
    ...['Row', 'Run', 'Assault Bike', 'Ski Erg'].map((name) => ({
      name,
      category: 'monostructural' as const,
    })),
  ],
};

/** Creates the template's programs, schedules, plans and movements in one box. */
export async function applyBoxTemplate(
  transaction: ScopedTransaction,
  boxId: string,
  options: { validFrom: string; template?: BoxTemplate },
) {
  const template = options.template ?? PARAGUAYAN_BOX_TEMPLATE;
  const programKeys = Object.keys(template.programs) as ProgramKey[];
  const createdPrograms = await transaction
    .insert(programs)
    .values(programKeys.map((key) => ({ boxId, ...template.programs[key] })))
    .returning({ id: programs.id });
  const programIds = Object.fromEntries(
    programKeys.map((key, index) => [key, createdPrograms[index]?.id]),
  ) as Record<ProgramKey, string>;

  await transaction.insert(classSchedules).values(
    template.schedules.map(({ program, ...schedule }) => ({
      boxId,
      ...schedule,
      programId: programIds[program],
      validFrom: options.validFrom,
    })),
  );

  for (const { programs: planProgramKeys = [], ...plan } of template.plans) {
    const [created] = await transaction
      .insert(plans)
      .values({ boxId, ...plan })
      .returning({ id: plans.id });
    if (created && planProgramKeys.length > 0) {
      await transaction
        .insert(planPrograms)
        .values(
          planProgramKeys.map((key) => ({ boxId, planId: created.id, programId: programIds[key] })),
        );
    }
  }

  await transaction
    .insert(movements)
    .values(template.movements.map((movement) => ({ boxId, ...movement })));
  return { programIds };
}
