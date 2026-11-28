import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './columns';
import { aiProviderEnum, featureFlagEnum } from './enums';
import { users } from './platform';
import { denyAppRole } from './rls';
import { tenantColumns, tenantIsolationPolicy } from './tenant';

/** The provider and model every AI feature uses. A single row, edited from the superadmin. */
export const aiSettings = pgTable(
  'ai_settings',
  {
    id: text().primaryKey().default('default'),
    provider: aiProviderEnum().notNull(),
    model: text().notNull(),
    updatedByUserId: uuid().references(() => users.id),
    ...timestamps(),
  },
  (table) => [check('ai_settings_single_row', sql`${table.id} = 'default'`), denyAppRole()],
);

/**
 * Provider API keys, encrypted with AES-GCM under the `AI_SECRETS_KEY` Worker
 * secret: the database alone never reveals a key. Only `withSystemScope` reads it.
 */
export const aiProviderKeys = pgTable(
  'ai_provider_keys',
  {
    provider: aiProviderEnum().primaryKey(),
    /** base64(iv || ciphertext || tag), bound to the provider name as associated data. */
    encryptedKey: text().notNull(),
    /** Last four characters, so the superadmin can tell which key is loaded. */
    keyHint: text().notNull(),
    updatedByUserId: uuid().references(() => users.id),
    ...timestamps(),
  },
  () => [denyAppRole()],
);

/** One AI request made for a box: the count per month enforces the plan's limit. */
export const aiUsage = pgTable(
  'ai_usage',
  {
    ...tenantColumns(),
    feature: featureFlagEnum().notNull(),
    userId: uuid().references(() => users.id),
    provider: aiProviderEnum().notNull(),
    model: text().notNull(),
    inputTokens: integer().notNull().default(0),
    outputTokens: integer().notNull().default(0),
  },
  (table) => [
    index('ai_usage_box_id_feature_created_at_idx').on(table.boxId, table.feature, table.createdAt),
    tenantIsolationPolicy(table.boxId),
  ],
);
