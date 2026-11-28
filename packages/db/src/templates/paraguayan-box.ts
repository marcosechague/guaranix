import type {
  ClassScheduleInput,
  CreatePlanInput,
  CreateProgramInput,
  MovementInput,
} from '@guaranix/shared/schemas';
import { BOX_TEMPLATES, type BoxSetup } from '@guaranix/shared';
import { classSchedules, movements, planPrograms, plans, programs } from '../schema';
import type { ScopedTransaction } from '../scope';

type ProgramKey = string;

export interface BoxTemplate {
  programs: Record<ProgramKey, Required<Pick<CreateProgramInput, 'name' | 'color'>>>;
  schedules: (Omit<ClassScheduleInput, 'programId' | 'validFrom'> & { program: ProgramKey })[];
  plans: (Omit<CreatePlanInput, 'programIds'> & { programs?: ProgramKey[] })[];
  movements: MovementInput[];
}

/** Expands the sign-up form's setup (one row per time, several weekdays) into rows to insert. */
export function boxTemplateFromSetup(setup: BoxSetup): BoxTemplate {
  return {
    programs: Object.fromEntries(
      setup.programs.map(({ key, name, color }) => [key, { name, color }]),
    ),
    schedules: setup.slots.flatMap(({ programKey, weekdays, ...slot }) =>
      weekdays.map((weekday) => ({ ...slot, weekday, program: programKey })),
    ),
    plans: setup.plans.map(({ programKeys = [], ...plan }) => ({
      ...plan,
      classesPerWeek: plan.classesPerWeek ?? null,
      classCount: plan.classCount ?? null,
      ...(programKeys.length > 0 ? { programs: programKeys } : {}),
    })),
    movements: setup.movements ?? [],
  };
}

/**
 * Typical box in Gran Asunción (see `BOX_TEMPLATES` in packages/shared for
 * every business type). Kept as rows for the seeds and their tests.
 */
export const PARAGUAYAN_BOX_TEMPLATE: BoxTemplate = boxTemplateFromSetup(
  BOX_TEMPLATES.functional_box,
);

/** Creates the template's programs, schedules, plans and movements in one box. */
export async function applyBoxTemplate(
  transaction: ScopedTransaction,
  boxId: string,
  options: { validFrom: string; template?: BoxTemplate },
) {
  const template = options.template ?? PARAGUAYAN_BOX_TEMPLATE;
  const programEntries = Object.entries(template.programs);
  const createdPrograms = await transaction
    .insert(programs)
    .values(programEntries.map(([, program]) => ({ boxId, ...program })))
    .returning({ id: programs.id });
  const programIds: Record<ProgramKey, string> = {};
  programEntries.forEach(([key], index) => {
    const id = createdPrograms[index]?.id;
    if (id) programIds[key] = id;
  });
  const programId = (key: ProgramKey) => {
    const id = programIds[key];
    if (!id) throw new Error(`Template references unknown program "${key}"`);
    return id;
  };

  if (template.schedules.length > 0) {
    await transaction.insert(classSchedules).values(
      template.schedules.map(({ program, ...schedule }) => ({
        boxId,
        ...schedule,
        programId: programId(program),
        validFrom: options.validFrom,
      })),
    );
  }

  for (const { programs: planProgramKeys = [], ...plan } of template.plans) {
    const [created] = await transaction
      .insert(plans)
      .values({ boxId, ...plan })
      .returning({ id: plans.id });
    if (created && planProgramKeys.length > 0) {
      await transaction
        .insert(planPrograms)
        .values(
          planProgramKeys.map((key) => ({ boxId, planId: created.id, programId: programId(key) })),
        );
    }
  }

  if (template.movements.length > 0) {
    await transaction
      .insert(movements)
      .values(template.movements.map((movement) => ({ boxId, ...movement })));
  }
  return { programIds };
}
