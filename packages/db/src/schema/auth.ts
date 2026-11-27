import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns';
import { boxes, users } from './platform';
import { appRole } from './rls';

// Login data is only ever touched by the auth service through `withSystemScope`.
// Each table carries an explicit deny policy for the app role (and its grants are
// revoked in a migration), so no box-scoped request can read a hash or a token.
const denyAppRole = () =>
  pgPolicy('deny_app_role', { for: 'all', to: appRole, using: sql`false`, withCheck: sql`false` });

/** Password hash, kept out of `users` because box staff may read linked users. */
export const userCredentials = pgTable(
  'user_credentials',
  {
    userId: uuid()
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Self-describing, e.g. `pbkdf2-sha256$100000$<salt>$<hash>`, so it can be upgraded. */
    passwordHash: text().notNull(),
    ...timestamps(),
  },
  () => [denyAppRole()],
);

/** Sign-in providers linked to a user (Google for now). */
export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: primaryId(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text().notNull(),
    /** The provider's stable user id (`sub`), never the email, which can change. */
    providerSubject: text().notNull(),
    email: text(),
    ...timestamps(),
  },
  (table) => [
    unique('oauth_accounts_provider_subject_unique').on(table.provider, table.providerSubject),
    unique('oauth_accounts_user_provider_unique').on(table.userId, table.provider),
    denyAppRole(),
  ],
);

/** Logged-in browsers. The cookie holds a random token; only its SHA-256 is stored. */
export const sessions = pgTable(
  'sessions',
  {
    id: primaryId(),
    tokenHash: text().notNull().unique(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Box the session is working in; sets `app.box_id` for Row Level Security. */
    activeBoxId: uuid().references(() => boxes.id),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
    lastUsedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    ...timestamps(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId), denyAppRole()],
);

/** Single-use, short-lived "forgot password" links. Only the token's SHA-256 is stored. */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: primaryId(),
    tokenHash: text().notNull().unique(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('password_reset_tokens_user_id_idx').on(table.userId), denyAppRole()],
);

/**
 * Fixed-window counters for login, signup and password reset. Keys are HMACs
 * of the IP or email, so the table holds no personal data.
 */
export const rateLimitCounters = pgTable(
  'rate_limit_counters',
  {
    key: text().primaryKey(),
    windowStartedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    hits: integer().notNull().default(0),
  },
  () => [denyAppRole()],
);
