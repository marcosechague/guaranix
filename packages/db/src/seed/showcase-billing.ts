import { charges, payments } from '../schema';
import type { ScopedTransaction } from '../scope';
import { localDate } from './calendar';

interface SoldPlan {
  id: string;
  memberId: string;
  priceGs: number;
  startsOn: string;
}

/** Morning in Asunción on the given box-local date, as an instant. */
const morningOf = (date: string) => new Date(`${date}T13:00:00.000Z`);

/**
 * A month of front-desk activity: most fees paid in cash or by transfer, a few
 * overdue, and two transfers reported by members waiting for reception, one of
 * them the demo member's own.
 */
export async function seedShowcaseBilling(
  transaction: ScopedTransaction,
  options: { boxId: string; staffUserId: string; demoMemberId: string; sold: SoldPlan[] },
) {
  const { boxId, staffUserId, demoMemberId, sold } = options;
  const outcome = (plan: SoldPlan, index: number) =>
    plan.memberId === demoMemberId || index === 6
      ? 'reported'
      : index % 4 === 1
        ? 'overdue'
        : 'paid';
  const created = await transaction
    .insert(charges)
    .values(
      sold.map((plan, index) => ({
        boxId,
        memberId: plan.memberId,
        memberPlanId: plan.id,
        description: 'Cuota mensual',
        amountGs: plan.priceGs,
        dueOn: plan.startsOn,
        status: outcome(plan, index) === 'paid' ? ('paid' as const) : ('open' as const),
      })),
    )
    .returning();

  const rows = created.flatMap((charge, index): (typeof payments.$inferInsert)[] => {
    const plan = sold[index];
    if (!plan) return [];
    const base = {
      boxId,
      memberId: charge.memberId,
      chargeId: charge.id,
      amountGs: charge.amountGs,
    };
    switch (outcome(plan, index)) {
      case 'reported':
        return [
          {
            ...base,
            method: 'bank_transfer',
            status: 'pending_review',
            paidAt: morningOf(localDate(-1)),
            reference: `OP-${String(483_920 + index * 17)}`,
            receiptFileKey: `receipts/demo-${index}.jpg`,
          },
        ];
      case 'paid':
        return [
          {
            ...base,
            method: index % 3 === 0 ? 'cash' : 'bank_transfer',
            status: 'confirmed',
            paidAt: morningOf(charge.dueOn),
            reference: index % 3 === 0 ? null : `OP-${String(391_200 + index * 23)}`,
            recordedByUserId: staffUserId,
            reviewedByUserId: staffUserId,
            reviewedAt: morningOf(charge.dueOn),
          },
        ];
      default:
        // Left open past the due date, so it shows up among the debtors.
        return [];
    }
  });
  if (rows.length > 0) await transaction.insert(payments).values(rows);
}
