import { parseProviderAmount } from '../../money';
import type { ChargeOutcome } from '../../types';

/** Bancard's confirmation object: in the charge answer, the status query and the webhook. */
export interface BancardConfirmation {
  token?: string;
  shop_process_id?: string | number;
  response?: string;
  response_details?: string;
  amount?: string;
  currency?: string;
  authorization_number?: string | null;
  ticket_number?: string | null;
  response_code?: string;
  response_description?: string;
  extended_response_description?: string | null;
}

const text = (value: unknown) =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

/** "00" is Bancard's only approval code; every other code is a decline with its reason. */
export function outcomeOf(confirmation: BancardConfirmation): ChargeOutcome {
  const amountGs = parseProviderAmount(confirmation.amount);
  if (confirmation.response_code === '00' && amountGs !== null) {
    return {
      status: 'approved',
      amountGs,
      authorizationCode: text(confirmation.authorization_number),
      providerReference: text(confirmation.ticket_number),
    };
  }
  return {
    status: 'declined',
    declineCode: text(confirmation.response_code),
    declineMessage:
      text(confirmation.extended_response_description) ?? text(confirmation.response_description),
  };
}

/** What the event log keeps: no tokens, no card data, no buyer IP. */
export function summaryOf(confirmation: BancardConfirmation): Record<string, unknown> {
  return {
    shopProcessId: confirmation.shop_process_id ?? null,
    response: confirmation.response ?? null,
    responseCode: confirmation.response_code ?? null,
    responseDescription: confirmation.response_description ?? null,
    amount: confirmation.amount ?? null,
    currency: confirmation.currency ?? null,
    authorizationNumber: confirmation.authorization_number ?? null,
    ticketNumber: confirmation.ticket_number ?? null,
  };
}
