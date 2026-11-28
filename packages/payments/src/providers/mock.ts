import { PaymentProviderError } from '../errors';
import type {
  CardChargeInput,
  ChargeOutcome,
  PaymentProvider,
  PaymentProviderConfig,
  PaymentStatusResult,
} from '../types';

export const MOCK_SIGNATURE_HEADER = 'x-mock-signature';

/** In development, a charge whose amount ends in 13 is declined, to see the failure path. */
const DECLINED_SUFFIX = 13;

export interface MockBehaviour {
  /** Decides each card charge; throw a `PaymentProviderError` to simulate an outage. */
  charge?: (input: CardChargeInput) => ChargeOutcome;
  /** What `getPaymentStatus` reports per order. */
  statuses?: Map<number, PaymentStatusResult>;
  /** Card refs the member never finished saving. */
  unfinishedCards?: Set<string>;
  refundFails?: boolean;
}

export interface MockWebhookPayload {
  orderNumber: number;
  approved: boolean;
  amountGs: number;
}

async function hmac(key: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(body));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** A webhook as the mock processor would send it, for the dev simulator and tests. */
export async function signMockWebhook(privateKey: string, payload: MockWebhookPayload) {
  const body = JSON.stringify(payload);
  return { body, signature: await hmac(privateKey, body) };
}

const defaultCharge = (input: CardChargeInput): ChargeOutcome =>
  input.amountGs % 100 === DECLINED_SUFFIX
    ? { status: 'declined', declineCode: '51', declineMessage: 'Fondos insuficientes' }
    : {
        status: 'approved',
        amountGs: input.amountGs,
        authorizationCode: `A${input.orderNumber}`,
        providerReference: `T${input.orderNumber}`,
      };

/**
 * A processor with no network, for development and tests. Cards always end in
 * the card number's last four digits, and charges are approved unless told
 * otherwise. Never available in production (the API refuses it there).
 */
export function createMockPaymentProvider(
  config: Pick<PaymentProviderConfig, 'privateKey'>,
  behaviour: MockBehaviour = {},
): PaymentProvider {
  const lastDigits = (cardRef: string) => cardRef.padStart(4, '0').slice(-4);
  return {
    name: 'mock',
    async verifyCredentials() {
      if (config.privateKey.startsWith('invalid')) throw new PaymentProviderError('auth');
    },
    async createCustomer({ customerRef }) {
      return { customerRef };
    },
    async startCardRegistration({ cardRef }) {
      return { kind: 'mock', form: 'card', processId: `mock-card-${cardRef}` };
    },
    async findCard({ cardRef }) {
      if (behaviour.unfinishedCards?.has(cardRef)) return null;
      return { cardRef, brand: 'Visa', last4: lastDigits(cardRef), expiresOn: '12/30' };
    },
    async removeCard() {},
    async chargeCard(input) {
      return (behaviour.charge ?? defaultCharge)(input);
    },
    async startHostedPayment({ orderNumber }) {
      return { kind: 'mock', form: 'payment', processId: `mock-pay-${orderNumber}` };
    },
    resumeHostedPayment(processId) {
      return { kind: 'mock', form: 'payment', processId };
    },
    async getPaymentStatus(orderNumber) {
      return behaviour.statuses?.get(orderNumber) ?? { status: 'not_found' };
    },
    async refund() {
      if (behaviour.refundFails) throw new PaymentProviderError('not_supported');
    },
    async parseWebhook({ body, headers }) {
      const received = headers.get(MOCK_SIGNATURE_HEADER) ?? '';
      if (received !== (await hmac(config.privateKey, body))) {
        throw new PaymentProviderError('invalid_signature');
      }
      const payload = JSON.parse(body) as MockWebhookPayload;
      const outcome: ChargeOutcome = payload.approved
        ? {
            status: 'approved',
            amountGs: payload.amountGs,
            authorizationCode: `A${payload.orderNumber}`,
            providerReference: `T${payload.orderNumber}`,
          }
        : { status: 'declined', declineCode: '05', declineMessage: 'Rechazada' };
      return {
        type: 'payment',
        eventKey: `confirm:${payload.orderNumber}:${payload.approved ? 'approved' : 'declined'}`,
        orderNumber: payload.orderNumber,
        outcome,
        summary: { ...payload },
      };
    },
    webhookAcknowledgement: () => ({ status: 'success' }),
  };
}
