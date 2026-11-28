import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { dataImports } from './imports';
import { boxes } from './platform';
import { programs } from './classes';
import { memberPlanStatusEnum, planKindEnum } from './enums';
import { locations } from './locations';
import { members, boxUsers } from './people';
import { sameBoxReference, tenantColumns, tenantIsolationPolicy, tenantKey } from './tenant';

/** A plan a box sells: unlimited, N classes per week, class pack or drop-in. */
export const plans = pgTable(
  'plans',
  {
    ...tenantColumns(),
    name: text().notNull(),
    description: text(),
    kind: planKindEnum().notNull(),
    priceGs: integer().notNull(),
    classesPerWeek: integer(),
    classCount: integer(),
    durationDays: integer().notNull(),
    isActive: boolean().notNull().default(true),
    /** The import that created this row, if any. */
    importId: uuid(),
  },
  (table) => [
    tenantKey('plans', table.boxId, table.id),
    sameBoxReference(
      'plans_import_fk',
      [table.boxId, table.importId],
      [dataImports.boxId, dataImports.id],
    ),
    check('plans_price_non_negative', sql`${table.priceGs} >= 0`),
    check('plans_duration_positive', sql`${table.durationDays} > 0`),
    // Same rules as `planLimitIssues` in packages/shared.
    check(
      'plans_kind_limits',
      sql`case ${table.kind}
        when 'unlimited' then ${table.classesPerWeek} is null and ${table.classCount} is null
        when 'weekly_limit' then ${table.classesPerWeek} > 0 and ${table.classCount} is null
        when 'class_pack' then ${table.classesPerWeek} is null and ${table.classCount} >= 2
        when 'drop_in' then ${table.classesPerWeek} is null and ${table.classCount} = 1
      end`,
    ),
    tenantIsolationPolicy(table.boxId),
  ],
);

/** Programs a plan gives access to. No rows means every program. */
export const planPrograms = pgTable(
  'plan_programs',
  {
    boxId: uuid()
      .notNull()
      .references(() => boxes.id),
    planId: uuid().notNull(),
    programId: uuid().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.planId, table.programId] }),
    sameBoxReference('plan_programs_plan_fk', [table.boxId, table.planId], [plans.boxId, plans.id]),
    sameBoxReference(
      'plan_programs_program_fk',
      [table.boxId, table.programId],
      [programs.boxId, programs.id],
    ),
    tenantIsolationPolicy(table.boxId),
  ],
);

/** Locations a plan can be used at. No rows means every location (the pass between locations). */
export const planLocations = pgTable(
  'plan_locations',
  {
    boxId: uuid()
      .notNull()
      .references(() => boxes.id),
    planId: uuid().notNull(),
    locationId: uuid().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.planId, table.locationId] }),
    sameBoxReference(
      'plan_locations_plan_fk',
      [table.boxId, table.planId],
      [plans.boxId, plans.id],
    ),
    sameBoxReference(
      'plan_locations_location_fk',
      [table.boxId, table.locationId],
      [locations.boxId, locations.id],
    ),
    tenantIsolationPolicy(table.boxId),
  ],
);

/** A plan sold to a member, with price and limits frozen at sale time. */
export const memberPlans = pgTable(
  'member_plans',
  {
    ...tenantColumns(),
    memberId: uuid().notNull(),
    planId: uuid().notNull(),
    status: memberPlanStatusEnum().notNull().default('active'),
    startsOn: date().notNull(),
    endsOn: date().notNull(),
    priceGs: integer().notNull(),
    classesPerWeek: integer(),
    /** Credits left for packs and drop-ins; null means not credit-based. */
    classesRemaining: integer(),
    /** The import that created this row, if any. */
    importId: uuid(),
    /** The period this one renews automatically (card autopay); unique, so a period renews once. */
    renewedFromId: uuid(),
  },
  (table) => [
    tenantKey('member_plans', table.boxId, table.id),
    sameBoxReference(
      'member_plans_member_fk',
      [table.boxId, table.memberId],
      [members.boxId, members.id],
    ),
    sameBoxReference('member_plans_plan_fk', [table.boxId, table.planId], [plans.boxId, plans.id]),
    sameBoxReference(
      'member_plans_import_fk',
      [table.boxId, table.importId],
      [dataImports.boxId, dataImports.id],
    ),
    unique('member_plans_renewed_from_id_unique').on(table.renewedFromId),
    index('member_plans_box_id_member_id_idx').on(table.boxId, table.memberId),
    index('member_plans_box_id_ends_on_idx').on(table.boxId, table.endsOn),
    check('member_plans_dates_ordered', sql`${table.endsOn} >= ${table.startsOn}`),
    check('member_plans_price_non_negative', sql`${table.priceGs} >= 0`),
    check(
      'member_plans_classes_remaining_non_negative',
      sql`${table.classesRemaining} is null or ${table.classesRemaining} >= 0`,
    ),
    tenantIsolationPolicy(table.boxId),
  ],
);

/** A pause (travel, injury…) that freezes a member plan and extends its end date. */
export const planPauses = pgTable(
  'plan_pauses',
  {
    ...tenantColumns(),
    memberPlanId: uuid().notNull(),
    startsOn: date().notNull(),
    endsOn: date().notNull(),
    reason: text(),
    createdByUserId: uuid(),
  },
  (table) => [
    tenantKey('plan_pauses', table.boxId, table.id),
    sameBoxReference(
      'plan_pauses_member_plan_fk',
      [table.boxId, table.memberPlanId],
      [memberPlans.boxId, memberPlans.id],
    ),
    sameBoxReference(
      'plan_pauses_created_by_fk',
      [table.boxId, table.createdByUserId],
      [boxUsers.boxId, boxUsers.userId],
    ),
    check('plan_pauses_dates_ordered', sql`${table.endsOn} >= ${table.startsOn}`),
    tenantIsolationPolicy(table.boxId),
  ],
);
