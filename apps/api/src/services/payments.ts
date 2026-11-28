import { and, desc, eq, gte, lt, ne, sum, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import { members, payments } from '@guaranix/db/schema';
import type { PaymentStatus } from '@guaranix/shared/domain';
import type { recordPaymentSchema } from '@guaranix/shared/schemas';
import { recordAudit } from './audit';
import { getCharge, settleCharge } from './charges';
import { FRONT_DESK_ROLES, assertRole, isStaff, type ServiceContext } from './context';
import { conflict, notFound, unprocessable } from './errors';
import { getMember, getOwnMember } from './members';
import { canUseReceipt } from './receipts';

export type RecordPaymentInput = z.output<typeof recordPaymentSchema>;
export type PaymentRow = typeof payments.$inferSelect;

const isFrontDesk = (context: ServiceContext) =>
  (FRONT_DESK_ROLES as readonly string[]).includes(context.auth.role);

/** Guaraníes already paid or waiting for review against a charge. */
async function committedToCharge(context: ServiceContext, chargeId: string): Promise<number> {
  const [row] = await context.transaction
    .select({ total: sum(payments.amountGs).mapWith(Number) })
    .from(payments)
    .where(and(eq(payments.chargeId, chargeId), ne(payments.status, 'rejected')));
  return row?.total ?? 0;
}

/**
 * Records a manual payment. Front desk registers cash, transfers and QR as
 * already confirmed. A receipt must be one uploaded to this box (and, for a
 * member, one they uploaded themselves). A member can only report a transfer or QR with its
 * receipt, which waits for staff to confirm it. The same bank reference can't
 * be recorded twice, so a receipt sent twice is never counted twice.
 */
export async function recordPayment(
  context: ServiceContext,
  input: RecordPaymentInput,
): Promise<PaymentRow> {
  const staffEntry = isFrontDesk(context);
  if (!staffEntry && isStaff(context.auth.role)) throw unprocessable('payment_requires_front_desk');
  if (!staffEntry && input.method === 'cash') throw unprocessable('cash_requires_staff');
  if (!staffEntry && !input.receiptFileKey) throw unprocessable('receipt_required');
  if (input.receiptFileKey && !canUseReceipt(context, input.receiptFileKey)) {
    throw notFound('receipt');
  }
  const member = staffEntry
    ? await getMember(context, input.memberId)
    : await getOwnMember(context);
  if (!staffEntry && input.memberId !== member.id) throw notFound('member');

  if (input.chargeId) {
    const charge = await getCharge(context, input.chargeId);
    if (charge.memberId !== member.id) throw notFound('charge');
    if (charge.status !== 'open') throw unprocessable('charge_not_open');
    if ((await committedToCharge(context, charge.id)) + input.amountGs > charge.amountGs) {
      throw unprocessable('payment_exceeds_charge');
    }
  }
  if (input.reference) {
    const [duplicate] = await context.transaction
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.method, input.method),
          eq(payments.reference, input.reference),
          ne(payments.status, 'rejected'),
        ),
      );
    if (duplicate) throw conflict('payment_duplicate');
  }

  const status: PaymentStatus = staffEntry ? 'confirmed' : 'pending_review';
  const [payment] = await context.transaction
    .insert(payments)
    .values({
      ...input,
      memberId: member.id,
      boxId: context.auth.boxId,
      status,
      recordedByUserId: context.auth.userId,
      reviewedByUserId: staffEntry ? context.auth.userId : null,
      reviewedAt: staffEntry ? context.now : null,
    })
    .returning();
  if (!payment) throw new Error('Payment insert returned no row');
  if (payment.chargeId && status === 'confirmed') await settleCharge(context, payment.chargeId);
  await recordAudit(context, {
    action: 'payment.recorded',
    entityType: 'payment',
    entityId: payment.id,
    changes: { memberId: member.id, amountGs: payment.amountGs, method: payment.method, status },
  });
  return payment;
}

/** Front desk confirms or rejects a receipt a member sent. Each payment is reviewed once. */
export async function reviewPayment(
  context: ServiceContext,
  paymentId: string,
  decision: 'confirmed' | 'rejected',
): Promise<PaymentRow> {
  assertRole(context.auth.role, FRONT_DESK_ROLES);
  const [payment] = await context.transaction
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .for('update');
  if (!payment) throw notFound('payment');
  if (payment.status !== 'pending_review') throw conflict('payment_already_reviewed');
  const [reviewed] = await context.transaction
    .update(payments)
    .set({ status: decision, reviewedByUserId: context.auth.userId, reviewedAt: context.now })
    .where(eq(payments.id, payment.id))
    .returning();
  if (!reviewed) throw notFound('payment');
  if (reviewed.chargeId && decision === 'confirmed') await settleCharge(context, reviewed.chargeId);
  await recordAudit(context, {
    action: decision === 'confirmed' ? 'payment.confirmed' : 'payment.rejected',
    entityType: 'payment',
    entityId: payment.id,
    changes: { amountGs: payment.amountGs },
  });
  return reviewed;
}

/** Payments with the member's name, newest first, for the front desk. */
export async function listPayments(
  context: ServiceContext,
  query: {
    status?: PaymentStatus | undefined;
    memberId?: string | undefined;
    from?: Date | undefined;
    to?: Date | undefined;
  },
): Promise<(PaymentRow & { firstName: string; lastName: string })[]> {
  assertRole(context.auth.role, FRONT_DESK_ROLES);
  const filters: SQL[] = [];
  if (query.status) filters.push(eq(payments.status, query.status));
  if (query.memberId) filters.push(eq(payments.memberId, query.memberId));
  if (query.from) filters.push(gte(payments.paidAt, query.from));
  if (query.to) filters.push(lt(payments.paidAt, query.to));
  const rows = await context.transaction
    .select({ payment: payments, firstName: members.firstName, lastName: members.lastName })
    .from(payments)
    .innerJoin(members, eq(members.id, payments.memberId))
    .where(and(...filters))
    .orderBy(desc(payments.paidAt))
    .limit(500);
  return rows.map((row) => ({ ...row.payment, firstName: row.firstName, lastName: row.lastName }));
}
