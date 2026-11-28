import type { SchemaDatabase, ScopedTransaction } from '@guaranix/db';
import { charges } from '@guaranix/db/schema';
import { addDays, calendarDateIn, formatDayMonth, formatGuarani } from '@guaranix/shared';
import { and, countDistinct, eq, inArray, lt, sum } from 'drizzle-orm';
import { insertNotification, type NotificationEvent } from '../services/notifications/record';
import type { NotificationQueue } from '../services/notifications/queue';
import { type BoxJobResult, forEachNotifyingBox } from './notifying-boxes';

/** Days before the due date to remind, and days after it to insist. */
export const DUE_REMINDER_DAYS = [3, 0] as const;
export const OVERDUE_REMINDER_DAYS = [1, 7] as const;

type ChargeRow = typeof charges.$inferSelect;

function chargeEvent(
  kind: 'membership_due' | 'membership_overdue',
  charge: ChargeRow,
  offset: number,
  today: string,
): NotificationEvent {
  return {
    kind,
    key: `${charge.id}:${offset}`,
    audience: { type: 'members', memberIds: [charge.memberId] },
    params: {
      description: charge.description,
      amount: formatGuarani(charge.amountGs),
      date: formatDayMonth(charge.dueOn),
      dueToday: charge.dueOn === today ? 1 : null,
      tag: `charge-${charge.id}`,
    },
  };
}

async function chargeReminders(transaction: ScopedTransaction, today: string) {
  const dueDates = new Map<string, number>(
    DUE_REMINDER_DAYS.map((days) => [addDays(today, days), days]),
  );
  const overdueDates = new Map<string, number>(
    OVERDUE_REMINDER_DAYS.map((days) => [addDays(today, -days), days]),
  );
  const open = await transaction
    .select()
    .from(charges)
    .where(
      and(
        eq(charges.status, 'open'),
        inArray(charges.dueOn, [...dueDates.keys(), ...overdueDates.keys()]),
      ),
    );
  return open.map((charge) => {
    const due = dueDates.get(charge.dueOn);
    return due === undefined
      ? chargeEvent('membership_overdue', charge, overdueDates.get(charge.dueOn) ?? 0, today)
      : chargeEvent('membership_due', charge, due, today);
  });
}

/** What the box is owed in overdue charges, for the owner's Telegram summary. */
async function overdueDigest(
  transaction: ScopedTransaction,
  today: string,
): Promise<NotificationEvent | null> {
  const [totals] = await transaction
    .select({ members: countDistinct(charges.memberId), amount: sum(charges.amountGs) })
    .from(charges)
    .where(and(eq(charges.status, 'open'), lt(charges.dueOn, today)));
  if (!totals || totals.members === 0) return null;
  return {
    kind: 'staff_overdue_digest',
    key: today,
    audience: { type: 'staff', roles: ['box_owner', 'box_admin'] },
    params: { count: totals.members, amount: formatGuarani(Number(totals.amount ?? 0)) },
  };
}

/**
 * Daily, mid-morning in Asunción: reminds members of charges due in 3 days and
 * today, insists 1 and 7 days after, and sends managers the overdue summary.
 * The keys include the charge and the offset, so a re-run sends nothing new.
 */
export async function sendMembershipReminders(
  database: SchemaDatabase,
  queue: NotificationQueue,
  now: Date,
): Promise<BoxJobResult> {
  return forEachNotifyingBox(database, queue, 'Membership reminders', async (transaction, box) => {
    const today = calendarDateIn(box.timezone, now);
    const events = await chargeReminders(transaction, today);
    const digest = await overdueDigest(transaction, today);
    if (digest) events.push(digest);
    const ids: string[] = [];
    for (const event of events) {
      const id = await insertNotification(
        transaction,
        { boxId: box.id, actorUserId: null, now },
        event,
      );
      if (id) ids.push(id);
    }
    return ids;
  });
}
