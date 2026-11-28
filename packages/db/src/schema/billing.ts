import { sql } from 'drizzle-orm';
import { check, date, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { chargeStatusEnum, paymentMethodEnum, paymentStatusEnum } from './enums';
import { dataImports } from './imports';
import { members } from './people';
import { users } from './platform';
import { memberPlans } from './plans';
import { sameBoxReference, tenantColumns, tenantIsolationPolicy, tenantKey } from './tenant';

/** What a member owes (a monthly fee, a drop-in…). Open charges past due feed the debtor list. */
export const charges = pgTable(
  'charges',
  {
    ...tenantColumns(),
    memberId: uuid().notNull(),
    memberPlanId: uuid(),
    description: text().notNull(),
    amountGs: integer().notNull(),
    dueOn: date().notNull(),
    status: chargeStatusEnum().notNull().default('open'),
    /** The import that created this row, if any. */
    importId: uuid(),
  },
  (table) => [
    tenantKey('charges', table.boxId, table.id),
    sameBoxReference(
      'charges_member_fk',
      [table.boxId, table.memberId],
      [members.boxId, members.id],
    ),
    sameBoxReference(
      'charges_member_plan_fk',
      [table.boxId, table.memberPlanId],
      [memberPlans.boxId, memberPlans.id],
    ),
    sameBoxReference(
      'charges_import_fk',
      [table.boxId, table.importId],
      [dataImports.boxId, dataImports.id],
    ),
    index('charges_box_id_status_due_on_idx').on(table.boxId, table.status, table.dueOn),
    check('charges_amount_positive', sql`${table.amountGs} > 0`),
    tenantIsolationPolicy(table.boxId),
  ],
);

/**
 * A manual payment: cash taken by reception, or a transfer/QR the member
 * reports with a receipt (stored in R2) that staff then confirm.
 */
export const payments = pgTable(
  'payments',
  {
    ...tenantColumns(),
    memberId: uuid().notNull(),
    chargeId: uuid(),
    amountGs: integer().notNull(),
    method: paymentMethodEnum().notNull(),
    status: paymentStatusEnum().notNull().default('pending_review'),
    paidAt: timestamp({ withTimezone: true }).notNull(),
    reference: text(),
    receiptFileKey: text(),
    notes: text(),
    recordedByUserId: uuid().references(() => users.id),
    reviewedByUserId: uuid().references(() => users.id),
    reviewedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    tenantKey('payments', table.boxId, table.id),
    sameBoxReference(
      'payments_member_fk',
      [table.boxId, table.memberId],
      [members.boxId, members.id],
    ),
    sameBoxReference(
      'payments_charge_fk',
      [table.boxId, table.chargeId],
      [charges.boxId, charges.id],
    ),
    index('payments_box_id_paid_at_idx').on(table.boxId, table.paidAt),
    index('payments_box_id_member_id_idx').on(table.boxId, table.memberId),
    check('payments_amount_positive', sql`${table.amountGs} > 0`),
    check(
      'payments_qr_has_receipt',
      sql`${table.method} <> 'qr' or ${table.receiptFileKey} is not null`,
    ),
    check(
      'payments_review_consistent',
      sql`(${table.status} = 'pending_review') = (${table.reviewedAt} is null)`,
    ),
    tenantIsolationPolicy(table.boxId),
  ],
);
