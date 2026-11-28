import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  integer,
  pgPolicy,
  pgTable,
  primaryKey,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './columns';
import { featureFlagEnum } from './enums';
import { platformPlans, users } from './platform';
import { appRole } from './rls';
import { tenantColumns, tenantIsolationPolicy } from './tenant';

/**
 * Which paid extras each GuaraniX plan includes, and how many uses a month.
 * Part of the public catalog like `platform_plans`: boxes read it, only the
 * platform writes it (grants revoked in the migration).
 */
export const platformPlanFeatures = pgTable(
  'platform_plan_features',
  {
    platformPlanId: uuid()
      .notNull()
      .references(() => platformPlans.id),
    feature: featureFlagEnum().notNull(),
    enabled: boolean().notNull().default(false),
    /** Uses per calendar month in the box's time zone. Null means no limit. */
    monthlyLimit: integer(),
    updatedByUserId: uuid().references(() => users.id),
    ...timestamps(),
  },
  (table) => [
    primaryKey({ columns: [table.platformPlanId, table.feature] }),
    check(
      'platform_plan_features_limit_non_negative',
      sql`${table.monthlyLimit} is null or ${table.monthlyLimit} >= 0`,
    ),
    pgPolicy('platform_plan_features_select', { for: 'select', to: appRole, using: sql`true` }),
  ],
);

/**
 * A platform decision for one box that wins over its plan: turn a feature on
 * for a trial, off for abuse, or give a different limit. Null keeps the plan's.
 */
export const boxFeatureOverrides = pgTable(
  'box_feature_overrides',
  {
    ...tenantColumns(),
    feature: featureFlagEnum().notNull(),
    enabled: boolean(),
    monthlyLimit: integer(),
    updatedByUserId: uuid().references(() => users.id),
  },
  (table) => [
    unique('box_feature_overrides_box_id_feature_unique').on(table.boxId, table.feature),
    check(
      'box_feature_overrides_limit_non_negative',
      sql`${table.monthlyLimit} is null or ${table.monthlyLimit} >= 0`,
    ),
    tenantIsolationPolicy(table.boxId),
  ],
);
