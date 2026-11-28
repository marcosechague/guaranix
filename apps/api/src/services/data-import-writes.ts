import { charges, memberPlans, members, plans } from '@guaranix/db/schema';
import {
  normalizeText,
  type DataImportInput,
  type ImportAnalysis,
  type ImportedMember,
} from '@guaranix/shared';
import type { ServiceContext } from './context';
import type { BoxImportState } from './data-import-state';

// Postgres allows 65,535 parameters per statement; members have ~15 columns.
const BATCH_SIZE = 500;

async function insertInBatches<Row>(rows: Row[], insert: (batch: Row[]) => Promise<unknown>) {
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    await insert(rows.slice(start, start + BATCH_SIZE));
  }
}

/** Creates the sheet's new plans and returns every plan the rows can use, by normalized name. */
async function writePlans(
  context: ServiceContext,
  importId: string,
  analysis: ImportAnalysis,
  state: BoxImportState,
) {
  const values = analysis.plans.flatMap((outcome) =>
    outcome.status === 'new' && outcome.plan
      ? [{ ...outcome.plan, boxId: context.auth.boxId, importId, isActive: true }]
      : [],
  );
  const byName = new Map(state.plansByName);
  if (values.length === 0) return byName;
  const created = await context.transaction.insert(plans).values(values).returning();
  for (const plan of created) byName.set(normalizeText(plan.name), plan);
  return byName;
}

type WritableRow = ImportAnalysis['rows'][number] & { member: ImportedMember };

function isWritable(row: ImportAnalysis['rows'][number]): row is WritableRow {
  return row.status !== 'invalid' && row.member !== null;
}

/**
 * Writes the valid rows of an analysis. Member plans were already paid in the
 * old system, so they open no charge; only the outstanding balance becomes an
 * open charge, which is what puts the member on the debtor list.
 */
export async function writeImport(
  context: ServiceContext,
  importId: string,
  input: DataImportInput,
  analysis: ImportAnalysis,
  state: BoxImportState,
): Promise<void> {
  const boxId = context.auth.boxId;
  const plansByName = await writePlans(context, importId, analysis, state);
  const rows = analysis.rows.filter(isWritable);

  const newRows = rows.filter((row) => row.status === 'new');
  const memberIds = new Map<number, string>();
  for (const row of rows) if (row.existingMemberId) memberIds.set(row.index, row.existingMemberId);
  await insertInBatches(newRows, async (batch) => {
    const inserted = await context.transaction
      .insert(members)
      .values(
        batch.map(({ member }) => ({
          ...member,
          joinedOn: member.joinedOn ?? state.today,
          boxId,
          importId,
        })),
      )
      .returning({ id: members.id });
    batch.forEach((row, position) => {
      const id = inserted[position]?.id;
      if (!id) throw new Error('Member insert returned fewer rows than sent');
      memberIds.set(row.index, id);
    });
  });

  const memberPlanRows = rows.flatMap((row) => {
    const plan = row.plan && plansByName.get(normalizeText(row.plan.planName));
    const memberId = memberIds.get(row.index);
    if (!row.plan || !plan || !memberId) return [];
    return [
      {
        boxId,
        importId,
        memberId,
        planId: plan.id,
        startsOn: row.plan.startsOn,
        endsOn: row.plan.endsOn,
        priceGs: plan.priceGs,
        classesPerWeek: plan.classesPerWeek,
        classesRemaining: row.plan.classesRemaining,
      },
    ];
  });
  await insertInBatches(memberPlanRows, (batch) =>
    context.transaction.insert(memberPlans).values(batch),
  );

  const chargeRows = rows.flatMap((row) => {
    const memberId = memberIds.get(row.index);
    if (!row.balance || !memberId) return [];
    return [
      {
        boxId,
        importId,
        memberId,
        description: input.balanceDescription,
        amountGs: row.balance.amountGs,
        dueOn: row.balance.dueOn,
      },
    ];
  });
  await insertInBatches(chargeRows, (batch) => context.transaction.insert(charges).values(batch));
}
