import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns';
import { boxStatusEnum, businessTypeEnum } from './enums';
import { appRole, currentBoxId, currentUserId } from './rls';

/** GuaraniX's own subscription plans (base, founder…). Global and public to the app. */
export const platformPlans = pgTable(
  'platform_plans',
  {
    id: primaryId(),
    code: text().notNull().unique(),
    name: text().notNull(),
    monthlyPriceGs: integer().notNull(),
    extraLocationMonthlyPriceGs: integer().notNull(),
    description: text(),
    /** How many boxes may take this plan (founders: the first 15–20). Null means no limit. */
    boxLimit: integer(),
    isActive: boolean().notNull().default(true),
    ...timestamps(),
  },
  (table) => [
    check(
      'platform_plans_prices_non_negative',
      sql`${table.monthlyPriceGs} >= 0 and ${table.extraLocationMonthlyPriceGs} >= 0`,
    ),
    check(
      'platform_plans_box_limit_positive',
      sql`${table.boxLimit} is null or ${table.boxLimit} > 0`,
    ),
  ],
);

/** A tenant: one box or training center. */
export const boxes = pgTable(
  'boxes',
  {
    id: primaryId(),
    name: text().notNull(),
    slug: text().notNull().unique(),
    legalName: text(),
    ruc: text(),
    email: text(),
    phone: text(),
    address: text(),
    city: text(),
    timezone: text().notNull().default('America/Asuncion'),
    accentColor: text(),
    logoFileKey: text(),
    businessType: businessTypeEnum().notNull().default('functional_box'),
    status: boxStatusEnum().notNull().default('trial'),
    /** Why the platform suspended or removed the box, shown to its staff. */
    statusReason: text(),
    statusChangedAt: timestamp({ withTimezone: true }),
    trialEndsAt: timestamp({ withTimezone: true }),
    platformPlanId: uuid().references(() => platformPlans.id),
    /** Locations beyond the first, billed at the plan's extra-location price. */
    extraLocations: integer().notNull().default(0),
    bookingOpensHoursBefore: integer().notNull().default(24),
    bookingClosesMinutesBefore: integer().notNull().default(0),
    lateCancelMinutesBefore: integer().notNull().default(120),
    lateCancelConsumesCredit: boolean().notNull().default(true),
    noShowConsumesCredit: boolean().notNull().default(true),
    waitlistAutoPromote: boolean().notNull().default(true),
    // Where members pay by transfer or QR, shown in the member app. The QR image is in R2.
    paymentBankName: text(),
    paymentAccountNumber: text(),
    paymentAlias: text(),
    paymentHolderName: text(),
    /** RUC or cédula of the account holder. */
    paymentHolderDocument: text(),
    paymentQrFileKey: text(),
    paymentNote: text(),
    ...timestamps(),
  },
  (table) => [
    check(
      'boxes_booking_policy_non_negative',
      sql`${table.bookingOpensHoursBefore} > 0 and ${table.bookingClosesMinutesBefore} >= 0 and ${table.lateCancelMinutesBefore} >= 0`,
    ),
    check('boxes_extra_locations_non_negative', sql`${table.extraLocations} >= 0`),
    pgPolicy('boxes_select_own', {
      for: 'select',
      to: appRole,
      using: sql`${table.id} = ${currentBoxId}`,
    }),
    pgPolicy('boxes_update_own', {
      for: 'update',
      to: appRole,
      using: sql`${table.id} = ${currentBoxId}`,
      withCheck: sql`${table.id} = ${currentBoxId}`,
    }),
  ],
);

/**
 * A person who can log in. Global because one person may train in or work
 * for several boxes; per-box data lives in `box_users` and `members`.
 */
export const users = pgTable(
  'users',
  {
    id: primaryId(),
    email: text(),
    phone: text(),
    fullName: text().notNull(),
    isPlatformAdmin: boolean().notNull().default(false),
    /** Set when the person proves they own the email (reset link or Google). */
    emailVerifiedAt: timestamp({ withTimezone: true }),
    lastLoginAt: timestamp({ withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('users_email_unique').on(table.email),
    uniqueIndex('users_phone_unique').on(table.phone),
    check('users_has_contact', sql`${table.email} is not null or ${table.phone} is not null`),
    // A box sees only people linked to it; box_users is itself filtered by box.
    pgPolicy('users_select_linked', {
      for: 'select',
      to: appRole,
      using: sql`${table.id} = ${currentUserId} or exists (select 1 from box_users where box_users.user_id = ${table.id})`,
    }),
    pgPolicy('users_update_self', {
      for: 'update',
      to: appRole,
      using: sql`${table.id} = ${currentUserId}`,
      withCheck: sql`${table.id} = ${currentUserId}`,
    }),
  ],
);
