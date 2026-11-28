import { and, asc, eq, inArray, lt, sum, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import { charges, memberPlans, members, payments } from '@guaranix/db/schema';
import type { ChargeStatus } from '@guaranix/shared/domain';
import type { chargeSchema } from '@guaranix/shared/schemas';
import { daysBetween } from '@guaranix/shared';
import { recordAudit } from './audit';
import { boxToday } from './box-calendar';
import { FRONT_DESK_ROLES, MANAGER_ROLES, assertRole, type ServiceContext } from './context';
import { conflict, notFound, unprocessable } from './errors';
import { getMember, getOwnMember } from './members';

export type ChargeInput = z.output<typeof chargeSchema>;
export type ChargeRow = typeof charges.$inferSelect;
/** Charge helpers the autopay job also uses, outside any user's request. */
type TransactionContext = Pick<ServiceContext, 'transaction'>;

export type ChargeView = ChargeRow & { paidGs: number; outstandingGs: number };

/** Confirmed guaraníes per charge. Pending receipts don't count until staff confirm them. */
export async function confirmedPaidByCharge(
  context: TransactionContext,
  chargeIds: string[],
): Promise<Map<string, number>> {
  if (chargeIds.length === 0) return new Map();
  const rows = await context.transaction
    .select({ chargeId: payments.chargeId, paid: sum(payments.amountGs).mapWith(Number) })
    .from(payments)
    .where(and(inArray(payments.chargeId, chargeIds), eq(payments.status, 'confirmed')))
    .groupBy(payments.chargeId);
  return new Map(rows.map((row) => [row.chargeId ?? '', row.paid ?? 0]));
}

async function withBalances(context: ServiceContext, rows: ChargeRow[]): Promise<ChargeView[]> {
  const paid = await confirmedPaidByCharge(
    context,
    rows.map((row) => row.id),
  );
  return rows.map((row) => {
    const paidGs = paid.get(row.id) ?? 0;
    const outstandingGs = row.status === 'open' ? Math.max(row.amountGs - paidGs, 0) : 0;
    return { ...row, paidGs, outstandingGs };
  });
}

export async function getCharge(context: TransactionContext, chargeId: string): Promise<ChargeRow> {
  const [charge] = await context.transaction.select().from(charges).where(eq(charges.id, chargeId));
  if (!charge) throw notFound('charge');
  return charge;
}

export async function listCharges(
  context: ServiceContext,
  query: { memberId?: string | undefined; status?: ChargeStatus | undefined },
): Promise<ChargeView[]> {
  assertRole(context.auth.role, FRONT_DESK_ROLES);
  const filters: SQL[] = [];
  if (query.memberId) filters.push(eq(charges.memberId, query.memberId));
  if (query.status) filters.push(eq(charges.status, query.status));
  const rows = await context.transaction
    .select()
    .from(charges)
    .where(and(...filters))
    .orderBy(asc(charges.dueOn));
  return withBalances(context, rows);
}

/** What the signed-in member owes and what they paid, for "Mi cuota". */
export async function ownAccount(context: ServiceContext) {
  const member = await getOwnMember(context);
  const rows = await context.transaction
    .select()
    .from(charges)
    .where(eq(charges.memberId, member.id))
    .orderBy(asc(charges.dueOn));
  const history = await context.transaction
    .select()
    .from(payments)
    .where(eq(payments.memberId, member.id))
    .orderBy(asc(payments.paidAt));
  // Notes written by staff are internal to the box; the member only sees their own.
  const ownHistory = history.map((payment) => ({
    ...payment,
    notes: payment.recordedByUserId === context.auth.userId ? payment.notes : null,
    recordedByUserId: null,
    reviewedByUserId: null,
  }));
  const balances = await withBalances(context, rows);
  return {
    charges: balances,
    payments: ownHistory,
    outstandingGs: balances.reduce((total, charge) => total + charge.outstandingGs, 0),
  };
}

/** What a member owes on charges already past due: what "cuota al día" checks. */
export async function overdueOwedBy(
  context: ServiceContext,
  memberId: string,
  today: string,
): Promise<number> {
  const rows = await context.transaction
    .select()
    .from(charges)
    .where(
      and(eq(charges.memberId, memberId), eq(charges.status, 'open'), lt(charges.dueOn, today)),
    );
  const balances = await withBalances(context, rows);
  return balances.reduce((total, charge) => total + charge.outstandingGs, 0);
}

export async function createCharge(
  context: ServiceContext,
  input: ChargeInput,
): Promise<ChargeRow> {
  assertRole(context.auth.role, FRONT_DESK_ROLES);
  const member = await getMember(context, input.memberId);
  if (input.memberPlanId) {
    const [plan] = await context.transaction
      .select({ memberId: memberPlans.memberId })
      .from(memberPlans)
      .where(eq(memberPlans.id, input.memberPlanId));
    if (!plan || plan.memberId !== member.id) throw notFound('member_plan');
  }
  const [charge] = await context.transaction
    .insert(charges)
    .values({ ...input, status: 'open', boxId: context.auth.boxId })
    .returning();
  if (!charge) throw new Error('Charge insert returned no row');
  await recordAudit(context, {
    action: 'charge.created',
    entityType: 'charge',
    entityId: charge.id,
    changes: { memberId: member.id, amountGs: charge.amountGs, dueOn: charge.dueOn },
  });
  return charge;
}

/** Cancels a debt that shouldn't exist. Charges with confirmed money can't be voided. */
export async function voidCharge(context: ServiceContext, chargeId: string): Promise<ChargeRow> {
  assertRole(context.auth.role, MANAGER_ROLES);
  const charge = await getCharge(context, chargeId);
  if (charge.status !== 'open') throw unprocessable('charge_not_open');
  if (((await confirmedPaidByCharge(context, [charge.id])).get(charge.id) ?? 0) > 0) {
    throw conflict('charge_has_payments');
  }
  const [voided] = await context.transaction
    .update(charges)
    .set({ status: 'void' })
    .where(eq(charges.id, charge.id))
    .returning();
  if (!voided) throw notFound('charge');
  await recordAudit(context, {
    action: 'charge.voided',
    entityType: 'charge',
    entityId: charge.id,
    changes: { amountGs: charge.amountGs },
  });
  return voided;
}

/** Marks a charge paid once confirmed payments cover it. */
export async function settleCharge(context: TransactionContext, chargeId: string): Promise<void> {
  const charge = await getCharge(context, chargeId);
  if (charge.status !== 'open') return;
  const paid = (await confirmedPaidByCharge(context, [charge.id])).get(charge.id) ?? 0;
  if (paid >= charge.amountGs) {
    await context.transaction
      .update(charges)
      .set({ status: 'paid' })
      .where(eq(charges.id, charge.id));
  }
}

/** After a refund: a paid charge whose confirmed money no longer covers it is owed again. */
export async function reopenCharge(context: TransactionContext, chargeId: string): Promise<void> {
  const charge = await getCharge(context, chargeId);
  if (charge.status !== 'paid') return;
  const paid = (await confirmedPaidByCharge(context, [charge.id])).get(charge.id) ?? 0;
  if (paid < charge.amountGs) {
    await context.transaction
      .update(charges)
      .set({ status: 'open' })
      .where(eq(charges.id, charge.id));
  }
}

/**
 * Members with open charges past their due date, biggest debt first.
 * Computed from `charges`, so there is no separate debtor state to keep in sync.
 */
export async function listDebtors(context: ServiceContext) {
  assertRole(context.auth.role, FRONT_DESK_ROLES);
  const today = await boxToday(context);
  const overdue = await context.transaction
    .select({
      charge: charges,
      firstName: members.firstName,
      lastName: members.lastName,
      phone: members.phone,
    })
    .from(charges)
    .innerJoin(members, eq(members.id, charges.memberId))
    .where(and(eq(charges.status, 'open'), lt(charges.dueOn, today)));
  const balances = await withBalances(
    context,
    overdue.map((row) => row.charge),
  );

  const byMember = new Map<
    string,
    {
      memberId: string;
      firstName: string;
      lastName: string;
      phone: string | null;
      owedGs: number;
      oldestDueOn: string;
      charges: number;
    }
  >();
  for (const row of overdue) {
    const outstanding = balances.find((charge) => charge.id === row.charge.id)?.outstandingGs ?? 0;
    if (outstanding === 0) continue;
    const current = byMember.get(row.charge.memberId) ?? {
      memberId: row.charge.memberId,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      owedGs: 0,
      oldestDueOn: row.charge.dueOn,
      charges: 0,
    };
    current.owedGs += outstanding;
    current.charges += 1;
    if (row.charge.dueOn < current.oldestDueOn) current.oldestDueOn = row.charge.dueOn;
    byMember.set(row.charge.memberId, current);
  }
  return [...byMember.values()]
    .map((debtor) => ({ ...debtor, daysOverdue: daysBetween(debtor.oldestDueOn, today) }))
    .sort((first, second) => second.owedGs - first.owedGs);
}
