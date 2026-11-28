import type { PaymentProviderEnvironment, PaymentProviderName } from '@guaranix/shared/domain';

/** What a box connects: its own commerce account, so money goes straight to the box. */
export interface PaymentProviderConfig {
  provider: PaymentProviderName;
  environment: PaymentProviderEnvironment;
  publicKey: string;
  privateKey: string;
  /** Injected in tests; the Worker's global `fetch` otherwise. */
  fetch?: typeof fetch;
}

/**
 * Where the member types the card: always the processor's own form, never
 * ours, so card numbers never reach GuaraniX.
 */
export type HostedCheckout =
  | {
      kind: 'bancard';
      /** Card registration or a one-off payment. */
      form: 'card' | 'payment';
      processId: string;
      /** Bancard's checkout script, which renders the iframe. */
      scriptUrl: string;
    }
  | {
      /** Development only: the app shows "approve" and "decline" buttons. */
      kind: 'mock';
      form: 'card' | 'payment';
      processId: string;
    };

export interface CustomerInput {
  /** Number GuaraniX picked for this member (Bancard's `user_id`). */
  customerRef: string;
}

export interface CardRegistrationInput {
  customerRef: string;
  /** Number GuaraniX picked for this card (Bancard's `card_id`). */
  cardRef: string;
  email: string | null;
  phone: string | null;
  /** Page of the member app the form goes back to. */
  returnUrl: string;
}

export interface CardIdentity {
  customerRef: string;
  cardRef: string;
}

export interface RegisteredCard {
  cardRef: string;
  brand: string | null;
  last4: string | null;
  /** As the processor shows it, e.g. `08/29`. */
  expiresOn: string | null;
}

export interface CardChargeInput extends CardIdentity {
  /** Unique per order; the processor refuses to process the same number twice. */
  orderNumber: number;
  amountGs: number;
  description: string;
}

export interface HostedPaymentInput {
  orderNumber: number;
  amountGs: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}

/**
 * A charge the processor answered. Network failures and timeouts are not
 * outcomes: they throw `PaymentProviderError('unavailable')` and the attempt
 * stays pending until `getPaymentStatus` settles it.
 */
export type ChargeOutcome =
  | {
      status: 'approved';
      amountGs: number;
      authorizationCode: string | null;
      providerReference: string | null;
    }
  | {
      status: 'declined';
      declineCode: string | null;
      declineMessage: string | null;
    };

export type PaymentStatusResult = ChargeOutcome | { status: 'not_found' };

export interface WebhookRequest {
  /** The raw body exactly as received: signatures are computed over it or its fields. */
  body: string;
  headers: Headers;
}

/** A payment the processor confirmed (or declined) through the webhook. */
export interface PaymentWebhookEvent {
  type: 'payment';
  /** Stable per event, so a resent webhook is recognised and ignored. */
  eventKey: string;
  orderNumber: number;
  outcome: ChargeOutcome;
  /** Non-sensitive fields only, for the event log. */
  summary: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  /** A cheap authenticated call, so a box knows its keys work before saving them. */
  verifyCredentials(): Promise<void>;
  /** Registers the member with the processor, where it needs that; returns its reference. */
  createCustomer(input: CustomerInput): Promise<{ customerRef: string }>;
  /** Opens the processor's hosted form to save a card ("guardar tarjeta"). */
  startCardRegistration(input: CardRegistrationInput): Promise<HostedCheckout>;
  /** The card once the member finished the form, or null if it was not saved. */
  findCard(card: CardIdentity): Promise<RegisteredCard | null>;
  removeCard(card: CardIdentity): Promise<void>;
  /** Charges a saved card with no one present (autopay). */
  chargeCard(input: CardChargeInput): Promise<ChargeOutcome>;
  /** Opens the hosted form for a one-off payment (payment link). */
  startHostedPayment(input: HostedPaymentInput): Promise<HostedCheckout>;
  /** The same payment form again (a second tab, a reload), without a new order. */
  resumeHostedPayment(processId: string): HostedCheckout;
  /** What happened to an order, to settle attempts whose answer never arrived. */
  getPaymentStatus(orderNumber: number): Promise<PaymentStatusResult>;
  /** Gives the money back. Throws `not_supported` when the processor no longer allows it. */
  refund(input: { orderNumber: number; amountGs: number }): Promise<void>;
  /** Verifies the signature and reads the event; throws `invalid_signature` otherwise. */
  parseWebhook(request: WebhookRequest): Promise<PaymentWebhookEvent>;
  /** The body the processor expects back once an event is stored. */
  webhookAcknowledgement(): Record<string, unknown>;
}
