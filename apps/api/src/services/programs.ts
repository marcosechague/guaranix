import { asc, eq } from 'drizzle-orm';
import { programs } from '@guaranix/db/schema';
import type { CreateProgramInput } from '@guaranix/shared/schemas';
import { diff, recordAudit } from './audit';
import { MANAGER_ROLES, assertRole, isStaff, type ServiceContext } from './context';
import { conflict, isUniqueViolation, notFound } from './errors';
import { definedFields } from './objects';

export type ProgramRow = typeof programs.$inferSelect;

export interface UpdateProgramInput {
  name?: string | undefined;
  description?: string | null | undefined;
  color?: string | null | undefined;
  isActive?: boolean | undefined;
}

function translateUniqueViolation(error: unknown): never {
  if (isUniqueViolation(error)) throw conflict('program_name_taken');
  throw error;
}

export async function listPrograms(context: ServiceContext): Promise<ProgramRow[]> {
  const query = context.transaction.select().from(programs).orderBy(asc(programs.name));
  return isStaff(context.auth.role) ? query : query.where(eq(programs.isActive, true));
}

export async function getProgram(context: ServiceContext, programId: string): Promise<ProgramRow> {
  const [program] = await context.transaction
    .select()
    .from(programs)
    .where(eq(programs.id, programId));
  if (!program) throw notFound('program');
  return program;
}

export async function createProgram(
  context: ServiceContext,
  input: CreateProgramInput,
): Promise<ProgramRow> {
  assertRole(context.auth.role, MANAGER_ROLES);
  const [program] = await context.transaction
    .insert(programs)
    .values({ ...definedFields(input), name: input.name, boxId: context.auth.boxId })
    .returning()
    .catch(translateUniqueViolation);
  if (!program) throw new Error('Program insert returned no row');
  await recordAudit(context, {
    action: 'program.created',
    entityType: 'program',
    entityId: program.id,
  });
  return program;
}

export async function updateProgram(
  context: ServiceContext,
  programId: string,
  input: UpdateProgramInput,
): Promise<ProgramRow> {
  assertRole(context.auth.role, MANAGER_ROLES);
  const before = await getProgram(context, programId);
  const fields = definedFields(input);
  if (Object.keys(fields).length === 0) return before;
  const [program] = await context.transaction
    .update(programs)
    .set(fields)
    .where(eq(programs.id, programId))
    .returning()
    .catch(translateUniqueViolation);
  if (!program) throw notFound('program');
  await recordAudit(context, {
    action: 'program.updated',
    entityType: 'program',
    entityId: program.id,
    changes: diff(before, fields),
  });
  return program;
}
