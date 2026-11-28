import { openSecret, sealSecret } from '@guaranix/ai';
import type { ScopedTransaction } from '@guaranix/db';
import { boxes, paymentAccounts } from '@guaranix/db/schema';
import {
  type PaymentProvider,
  type PaymentProviderConfig,
  PaymentProviderError,
} from '@guaranix/payments';
import type { PaymentProviderName } from '@guaranix/shared/domain';
import { eq } from 'drizzle-orm';
import type { AppEnvironment, Bindings, Services } from '../env';
import { boxFeatureState } from './feature-access';
import { type ServiceError, unprocessable } from './errors';

export type PaymentProviderFactory = (config: PaymentProviderConfig) => PaymentProvider;
export type PaymentAccountRow = typeof paymentAccounts.$inferSelect;

/** What card-payment services need beyond the database: keys, adapters and URLs. */
export interface PaymentRuntime {
  secretsKey: string | undefined;
  factory: PaymentProviderFactory;
  appEnv: AppEnvironment;
  publicApiUrl: string;
  memberAppUrl: string;
}

/**
 * The private key is bound to the box and provider as associated data, so a
 * sealed key copied into another box's row (or another provider) won't open.
 */
const sealContext = (boxId: string, provider: PaymentProviderName) =>
  `payments:${boxId}:${provider}`;

export async function sealPrivateKey(
  runtime: PaymentRuntime,
  boxId: string,
  provider: PaymentProviderName,
  privateKey: string,
): Promise<string> {
  if (!runtime.secretsKey) throw unprocessable('payments_secrets_key_missing');
  return sealSecret(runtime.secretsKey, privateKey, sealContext(boxId, provider));
}

/** The mock processor approves anything, so it never runs in production. */
export function providerAllowed(runtime: PaymentRuntime, provider: PaymentProviderName): boolean {
  return provider !== 'mock' || runtime.appEnv !== 'production';
}

/** The account's private key, decrypted in memory for one call. */
export async function openPrivateKey(
  runtime: PaymentRuntime,
  account: PaymentAccountRow,
): Promise<string> {
  if (!runtime.secretsKey) throw unprocessable('payments_secrets_key_missing');
  return openSecret(
    runtime.secretsKey,
    account.encryptedPrivateKey,
    sealContext(account.boxId, account.provider),
  ).catch(() => {
    // Rotated master key: the box has to load its keys again.
    throw unprocessable('payment_keys_unreadable');
  });
}

/** The box's processor with its private key decrypted in memory, for this call only. */
export async function providerForAccount(
  runtime: PaymentRuntime,
  account: PaymentAccountRow,
): Promise<PaymentProvider> {
  if (!providerAllowed(runtime, account.provider))
    throw unprocessable('payment_provider_unavailable');
  return runtime.factory({
    provider: account.provider,
    environment: account.environment,
    publicKey: account.publicKey,
    privateKey: await openPrivateKey(runtime, account),
  });
}

/** The box's account, connected or not. Null when it never connected one. */
export async function findPaymentAccount(
  transaction: ScopedTransaction,
  boxId: string,
): Promise<PaymentAccountRow | null> {
  const [account] = await transaction
    .select()
    .from(paymentAccounts)
    .where(eq(paymentAccounts.boxId, boxId));
  return account ?? null;
}

/**
 * The account card payments run on right now: connected, allowed in this
 * environment, and the box's GuaraniX plan (or a platform override) includes
 * `card_payments`. Null otherwise; nothing is charged without all three.
 */
export async function activePaymentAccount(
  transaction: ScopedTransaction,
  runtime: PaymentRuntime,
  boxId: string,
  now: Date,
): Promise<PaymentAccountRow | null> {
  const account = await findPaymentAccount(transaction, boxId);
  if (!account || account.disconnectedAt || !providerAllowed(runtime, account.provider))
    return null;
  const [box] = await transaction
    .select({ status: boxes.status })
    .from(boxes)
    .where(eq(boxes.id, boxId));
  if (!box || (box.status !== 'trial' && box.status !== 'active')) return null;
  const feature = await boxFeatureState(transaction, boxId, 'card_payments', now);
  return feature.effective.enabled ? account : null;
}

/** Processor failures as stable codes the apps translate; nothing from the processor leaks. */
export function paymentServiceError(error: PaymentProviderError): ServiceError {
  switch (error.code) {
    case 'auth':
      return unprocessable('payment_keys_rejected');
    case 'unavailable':
      return unprocessable('payment_provider_down');
    case 'not_supported':
      return unprocessable('refund_not_available');
    case 'bad_request':
    case 'invalid_signature':
      return unprocessable('payment_provider_rejected');
  }
}

/** Runs a processor call and converts its failures; other errors pass through. */
export async function callPaymentProvider<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof PaymentProviderError) throw paymentServiceError(error);
    throw error;
  }
}

/** URL a box gives its processor for confirmations: one per account, so we know whose key signs it. */
export const webhookUrlFor = (runtime: PaymentRuntime, accountId: string) =>
  `${runtime.publicApiUrl.replace(/\/$/, '')}/webhooks/payments/${accountId}`;

export const memberAppUrl = (runtime: PaymentRuntime, path: string) =>
  `${runtime.memberAppUrl.replace(/\/$/, '')}${path}`;

/** The payment runtime for a request or a cron run. */
export function paymentRuntimeFor(
  env: Pick<Bindings, 'PAYMENTS_SECRETS_KEY' | 'APP_ENV' | 'PUBLIC_API_URL' | 'MEMBER_APP_URL'>,
  services: Pick<Services, 'paymentProviderFactory'>,
): PaymentRuntime {
  return {
    secretsKey: env.PAYMENTS_SECRETS_KEY,
    factory: services.paymentProviderFactory,
    appEnv: env.APP_ENV,
    publicApiUrl: env.PUBLIC_API_URL,
    memberAppUrl: env.MEMBER_APP_URL,
  };
}
