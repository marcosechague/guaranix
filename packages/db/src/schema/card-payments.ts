import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  paymentAttemptKindEnum,
  paymentAttemptStatusEnum,
  paymentProviderEnum,
  paymentProviderEnvironmentEnum,
  savedCardStatusEnum,
} from './enums';
import { charges, payments } from './billing';
import { members } from './people';
import { users } from './platform';
import { sameBoxReference, tenantColumns, tenantIsolationPolicy, tenantKey } from './tenant';

/**
 * Numbers sent to card processors as customer, card and order references.
 * Bancard wants integers unique per commerce; one global sequence keeps them
 * unique across every box and every reference type.
 */
export const providerReferenceSequence = pgSequence('provider_reference_seq', {
  startWith: 100000,
});

const nextProviderReference = sql`nextval('provider_reference_seq')`;

/**
 * The box's own account with a card processor: the money goes straight to the
 * box. The private key is sealed with AES-GCM under `PAYMENTS_SECRETS_KEY`,
 * bound to the box and provider, so the database alone never reveals it.
 */
export const paymentAccounts = pgTable(
  'payment_accounts',
  {
    ...tenantColumns(),
    provider: paymentProviderEnum().notNull(),
    environment: paymentProviderEnvironmentEnum().notNull(),
    publicKey: text().notNull(),
    /** base64(iv || ciphertext || tag). */
    encryptedPrivateKey: text().notNull(),
    /** Last four characters, so the owner can tell which key is loaded. */
    privateKeyHint: text().notNull(),
    /** The box turned automatic charges on. Members still need a saved card. */
    autopayEnabled: boolean().notNull().default(false),
    connectedByUserId: uuid().references(() => users.id),
    /**
     * Set when the box disconnects. The row and its sealed key stay, so late
     * confirmations of earlier orders can still be verified and refunded.
     */
    disconnectedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    tenantKey('payment_accounts', table.boxId, table.id),
    unique('payment_accounts_box_id_unique').on(table.boxId),
    tenantIsolationPolicy(table.boxId),
  ],
);

/** The member as the processor knows them (Bancard's `user_id`). */
export const paymentCustomers = pgTable(
  'payment_customers',
  {
    ...tenantColumns(),
    accountId: uuid().notNull(),
    memberId: uuid().notNull(),
    customerRef: text()
      .notNull()
      .default(sql`(${nextProviderReference})::text`),
  },
  (table) => [
    tenantKey('payment_customers', table.boxId, table.id),
    sameBoxReference(
      'payment_customers_account_fk',
      [table.boxId, table.accountId],
      [paymentAccounts.boxId, paymentAccounts.id],
    ),
    sameBoxReference(
      'payment_customers_member_fk',
      [table.boxId, table.memberId],
      [members.boxId, members.id],
    ),
    unique('payment_customers_account_id_member_id_unique').on(table.accountId, table.memberId),
    unique('payment_customers_customer_ref_unique').on(table.customerRef),
    tenantIsolationPolicy(table.boxId),
  ],
);

/**
 * A card the member registered on the processor's own form. GuaraniX never
 * sees the number: only the processor's reference, brand and last four digits.
 */
export const savedCards = pgTable(
  'saved_cards',
  {
    ...tenantColumns(),
    accountId: uuid().notNull(),
    customerId: uuid().notNull(),
    memberId: uuid().notNull(),
    cardRef: text()
      .notNull()
      .default(sql`(${nextProviderReference})::text`),
    status: savedCardStatusEnum().notNull().default('pending'),
    brand: text(),
    last4: text(),
    /** As the processor shows it, e.g. `08/29`. */
    expiresOn: text(),
    /** When the member accepted automatic charges on this card. */
    autopayConsentAt: timestamp({ withTimezone: true }).notNull(),
    activatedAt: timestamp({ withTimezone: true }),
    removedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    tenantKey('saved_cards', table.boxId, table.id),
    sameBoxReference(
      'saved_cards_account_fk',
      [table.boxId, table.accountId],
      [paymentAccounts.boxId, paymentAccounts.id],
    ),
    sameBoxReference(
      'saved_cards_customer_fk',
      [table.boxId, table.customerId],
      [paymentCustomers.boxId, paymentCustomers.id],
    ),
    sameBoxReference(
      'saved_cards_member_fk',
      [table.boxId, table.memberId],
      [members.boxId, members.id],
    ),
    unique('saved_cards_card_ref_unique').on(table.cardRef),
    // One card charged per member: a new one replaces the old once it is confirmed.
    uniqueIndex('saved_cards_one_active_per_member')
      .on(table.boxId, table.memberId)
      .where(sql`${table.status} = 'active'`),
    tenantIsolationPolicy(table.boxId),
  ],
);

/** Short-lived links a member opens to pay one charge (sent by WhatsApp when autopay fails). */
export const paymentLinks = pgTable(
  'payment_links',
  {
    ...tenantColumns(),
    chargeId: uuid().notNull(),
    memberId: uuid().notNull(),
    /** SHA-256 of the token in the URL; the token itself is never stored. */
    tokenHash: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    /** Null when the autopay job created it. */
    createdByUserId: uuid().references(() => users.id),
  },
  (table) => [
    tenantKey('payment_links', table.boxId, table.id),
    sameBoxReference(
      'payment_links_charge_fk',
      [table.boxId, table.chargeId],
      [charges.boxId, charges.id],
    ),
    sameBoxReference(
      'payment_links_member_fk',
      [table.boxId, table.memberId],
      [members.boxId, members.id],
    ),
    unique('payment_links_token_hash_unique').on(table.tokenHash),
    tenantIsolationPolicy(table.boxId),
  ],
);

/**
 * One try to collect a charge through the processor. It is written before the
 * processor is called, with an order number the processor rejects if reused,
 * so a crash or a retried job can never charge the same order twice.
 */
export const paymentAttempts = pgTable(
  'payment_attempts',
  {
    ...tenantColumns(),
    accountId: uuid().notNull(),
    chargeId: uuid().notNull(),
    memberId: uuid().notNull(),
    kind: paymentAttemptKindEnum().notNull(),
    savedCardId: uuid(),
    paymentLinkId: uuid(),
    /** Bancard's `shop_process_id`. */
    orderNumber: bigint({ mode: 'number' }).notNull().default(nextProviderReference),
    /** 1 for the first automatic try of a charge, then 2, 3… */
    attemptNumber: integer().notNull().default(1),
    amountGs: integer().notNull(),
    status: paymentAttemptStatusEnum().notNull().default('pending'),
    /** Processor's process id for a hosted checkout, reused while it is fresh. */
    checkoutRef: text(),
    authorizationCode: text(),
    providerReference: text(),
    declineCode: text(),
    declineMessage: text(),
    /** The confirmed `payments` row an approval created. */
    paymentId: uuid(),
    /** Day the next automatic try may run, set when this one is declined. */
    nextRetryOn: date(),
    resolvedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    tenantKey('payment_attempts', table.boxId, table.id),
    sameBoxReference(
      'payment_attempts_account_fk',
      [table.boxId, table.accountId],
      [paymentAccounts.boxId, paymentAccounts.id],
    ),
    sameBoxReference(
      'payment_attempts_charge_fk',
      [table.boxId, table.chargeId],
      [charges.boxId, charges.id],
    ),
    sameBoxReference(
      'payment_attempts_member_fk',
      [table.boxId, table.memberId],
      [members.boxId, members.id],
    ),
    sameBoxReference(
      'payment_attempts_card_fk',
      [table.boxId, table.savedCardId],
      [savedCards.boxId, savedCards.id],
    ),
    sameBoxReference(
      'payment_attempts_link_fk',
      [table.boxId, table.paymentLinkId],
      [paymentLinks.boxId, paymentLinks.id],
    ),
    sameBoxReference(
      'payment_attempts_payment_fk',
      [table.boxId, table.paymentId],
      [payments.boxId, payments.id],
    ),
    unique('payment_attempts_order_number_unique').on(table.orderNumber),
    unique('payment_attempts_payment_id_unique').on(table.paymentId),
    // The job may run twice; the second run can't create the same try again.
    uniqueIndex('payment_attempts_autopay_number')
      .on(table.chargeId, table.attemptNumber)
      .where(sql`${table.kind} = 'autopay'`),
    // One payment in flight per charge, autopay or link: never two charges for one debt.
    uniqueIndex('payment_attempts_one_pending_per_charge')
      .on(table.chargeId)
      .where(sql`${table.status} = 'pending'`),
    index('payment_attempts_box_id_charge_id_idx').on(table.boxId, table.chargeId),
    check('payment_attempts_amount_positive', sql`${table.amountGs} > 0`),
    check(
      'payment_attempts_kind_source',
      sql`(${table.kind} = 'autopay') = (${table.savedCardId} is not null)`,
    ),
    tenantIsolationPolicy(table.boxId),
  ],
);

/**
 * Append-only log of everything the processor told us: webhooks (valid or
 * not), charge answers and refunds. `eventKey` makes a repeated webhook a
 * no-op. Payloads are trimmed to non-sensitive fields before they get here.
 */
export const paymentEvents = pgTable(
  'payment_events',
  {
    ...tenantColumns(),
    accountId: uuid().notNull(),
    provider: paymentProviderEnum().notNull(),
    type: text().notNull(),
    eventKey: text(),
    orderNumber: bigint({ mode: 'number' }),
    signatureValid: boolean().notNull(),
    /** `processed`, `duplicate`, `rejected`, `ignored`. */
    outcome: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>(),
  },
  (table) => [
    sameBoxReference(
      'payment_events_account_fk',
      [table.boxId, table.accountId],
      [paymentAccounts.boxId, paymentAccounts.id],
    ),
    uniqueIndex('payment_events_account_id_event_key')
      .on(table.accountId, table.eventKey)
      .where(sql`${table.eventKey} is not null`),
    index('payment_events_box_id_created_at_idx').on(table.boxId, table.createdAt),
    tenantIsolationPolicy(table.boxId),
  ],
);
