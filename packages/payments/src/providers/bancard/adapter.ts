import { PaymentProviderError } from '../../errors';
import { formatProviderAmount } from '../../money';
import type {
  CardIdentity,
  PaymentProvider,
  PaymentProviderConfig,
  RegisteredCard,
  PaymentStatusResult,
} from '../../types';
import {
  type BancardResponse,
  bancardScriptUrl,
  callBancard,
  errorKeyOf,
  expectSuccess,
} from './client';
import { type BancardConfirmation, outcomeOf, summaryOf } from './confirmation';
import { bancardTokens, sameToken } from './tokens';

/** Bancard limits the description shown to the buyer to 20 characters. */
const DESCRIPTION_LENGTH = 20;

interface BancardCard {
  alias_token?: string;
  card_masked_number?: string;
  expiration_date?: string;
  card_brand?: string;
  card_id?: number | string;
}

const isNotFound = (body: BancardResponse) => /NotFound/i.test(errorKeyOf(body) ?? '');

const confirmationIn = (body: BancardResponse): BancardConfirmation | undefined =>
  (body['confirmation'] ?? body['operation']) as BancardConfirmation | undefined;

/**
 * Bancard vPOS 2.0: hosted iframe for card registration and one-off payments,
 * charges with the card's `alias_token`, and a signed confirmation webhook.
 * Numbers (`user_id`, `card_id`, `shop_process_id`) are chosen by GuaraniX.
 */
export function createBancardProvider(config: PaymentProviderConfig): PaymentProvider {
  const { environment, publicKey, privateKey } = config;
  const fetchImpl = config.fetch ?? fetch;
  const call = (method: 'POST' | 'DELETE', path: string, operation: Record<string, unknown>) =>
    callBancard({ environment, publicKey, method, path, operation, fetchImpl });

  async function listCards(customerRef: string): Promise<BancardCard[]> {
    const body = expectSuccess(
      await call('POST', `users/${customerRef}/cards`, {
        token: bancardTokens.userCards(privateKey, customerRef),
      }),
    );
    return Array.isArray(body['cards']) ? (body['cards'] as BancardCard[]) : [];
  }

  /** `alias_token` changes on every listing, so it is fetched right before each use. */
  async function aliasTokenOf(card: CardIdentity): Promise<string> {
    const found = (await listCards(card.customerRef)).find(
      (candidate) => String(candidate.card_id) === card.cardRef,
    );
    if (!found?.alias_token) throw new PaymentProviderError('bad_request', 'CardNotFound');
    return found.alias_token;
  }

  async function confirmedStatus(orderNumber: number): Promise<PaymentStatusResult> {
    const body = await call('POST', 'single_buy/confirmations', {
      token: bancardTokens.confirmation(privateKey, orderNumber),
      shop_process_id: orderNumber,
    });
    if (isNotFound(body)) return { status: 'not_found' };
    const confirmation = confirmationIn(expectSuccess(body));
    if (!confirmation?.response_code) return { status: 'not_found' };
    return outcomeOf(confirmation);
  }

  return {
    name: 'bancard',

    async verifyCredentials() {
      // A listing for a customer nobody has: valid keys answer with no cards.
      await listCards('1');
    },

    async createCustomer({ customerRef }) {
      // Bancard creates the user with their first card; the number is ours.
      return { customerRef };
    },

    async startCardRegistration(input) {
      const body = expectSuccess(
        await call('POST', 'cards/new', {
          token: bancardTokens.newCard(privateKey, input.cardRef, input.customerRef),
          card_id: Number(input.cardRef),
          user_id: Number(input.customerRef),
          user_cell_phone: input.phone ?? '',
          user_mail: input.email ?? '',
          return_url: input.returnUrl,
        }),
      );
      return {
        kind: 'bancard',
        form: 'card',
        processId: String(body['process_id']),
        scriptUrl: bancardScriptUrl(environment),
      };
    },

    async findCard(card): Promise<RegisteredCard | null> {
      const found = (await listCards(card.customerRef)).find(
        (candidate) => String(candidate.card_id) === card.cardRef,
      );
      if (!found) return null;
      const digits = found.card_masked_number?.replace(/\D/g, '') ?? '';
      return {
        cardRef: card.cardRef,
        brand: found.card_brand ?? null,
        last4: digits.length >= 4 ? digits.slice(-4) : null,
        expiresOn: found.expiration_date ?? null,
      };
    },

    async removeCard(card) {
      const aliasToken = await aliasTokenOf(card).catch((error: unknown) => {
        // Already gone at Bancard: removing it here is all that is left to do.
        if (error instanceof PaymentProviderError && error.detail === 'CardNotFound') return null;
        throw error;
      });
      if (!aliasToken) return;
      expectSuccess(
        await call('DELETE', `users/${card.customerRef}/cards`, {
          token: bancardTokens.deleteCard(privateKey, card.customerRef, aliasToken),
          alias_token: aliasToken,
        }),
      );
    },

    async chargeCard(input) {
      const aliasToken = await aliasTokenOf(input);
      const amount = formatProviderAmount(input.amountGs);
      const body = await call('POST', 'charge', {
        token: bancardTokens.charge(privateKey, input.orderNumber, amount, aliasToken),
        shop_process_id: input.orderNumber,
        amount,
        number_of_payments: 1,
        currency: 'PYG',
        additional_data: '',
        description: input.description.slice(0, DESCRIPTION_LENGTH),
        alias_token: aliasToken,
      });
      const confirmation = confirmationIn(body);
      if (confirmation?.response_code) return outcomeOf(confirmation);
      // An error answer is a decision too: Bancard did not take the money.
      if (body.status === 'error') {
        return {
          status: 'declined',
          declineCode: errorKeyOf(body) ?? null,
          declineMessage: body.messages?.[0]?.dsc ?? null,
        };
      }
      throw new PaymentProviderError('unavailable', 'no_confirmation');
    },

    async startHostedPayment(input) {
      const amount = formatProviderAmount(input.amountGs);
      const body = expectSuccess(
        await call('POST', 'single_buy', {
          token: bancardTokens.singleBuy(privateKey, input.orderNumber, amount),
          shop_process_id: input.orderNumber,
          amount,
          currency: 'PYG',
          additional_data: '',
          description: input.description.slice(0, DESCRIPTION_LENGTH),
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
        }),
      );
      return {
        kind: 'bancard',
        form: 'payment',
        processId: String(body['process_id']),
        scriptUrl: bancardScriptUrl(environment),
      };
    },

    resumeHostedPayment(processId) {
      return {
        kind: 'bancard',
        form: 'payment',
        processId,
        scriptUrl: bancardScriptUrl(environment),
      };
    },

    getPaymentStatus: confirmedStatus,

    async refund({ orderNumber }) {
      const body = await call('POST', 'single_buy/rollback', {
        token: bancardTokens.rollback(privateKey, orderNumber),
        shop_process_id: orderNumber,
      });
      if (body.status === 'success') return;
      // Rollback only works before Bancard closes the day; later it is done from their portal.
      throw new PaymentProviderError('not_supported', errorKeyOf(body) ?? 'unknown');
    },

    async parseWebhook({ body }) {
      let parsed: { operation?: BancardConfirmation };
      try {
        parsed = JSON.parse(body) as { operation?: BancardConfirmation };
      } catch {
        throw new PaymentProviderError('invalid_signature', 'invalid_json');
      }
      const operation = parsed.operation;
      const order = operation?.shop_process_id;
      if (!operation?.token || order === undefined || !operation.amount || !operation.currency) {
        throw new PaymentProviderError('invalid_signature', 'missing_fields');
      }
      const expected = bancardTokens.webhook(
        privateKey,
        String(order),
        operation.amount,
        operation.currency,
      );
      if (!sameToken(operation.token, expected)) {
        throw new PaymentProviderError('invalid_signature');
      }
      const orderNumber = Number(order);
      if (!Number.isSafeInteger(orderNumber)) {
        throw new PaymentProviderError('bad_request', 'invalid_order');
      }
      const outcome = outcomeOf(operation);
      if (outcome.status === 'approved') {
        // The confirmation token does not cover response_code, so an approval
        // only counts once Bancard says the same thing when we ask it directly.
        const confirmed = await confirmedStatus(orderNumber);
        if (confirmed.status !== 'approved' || confirmed.amountGs !== outcome.amountGs) {
          throw new PaymentProviderError('bad_request', 'approval_not_confirmed');
        }
      }
      return {
        type: 'payment',
        // A decline and a later approval of the same order are different events.
        eventKey: `confirm:${orderNumber}:${operation.response_code ?? ''}`,
        orderNumber,
        outcome,
        summary: summaryOf(operation),
      };
    },

    webhookAcknowledgement: () => ({ status: 'success' }),
  };
}
