import { secretHint } from '@guaranix/ai';
import { paymentAccounts, paymentAttempts, savedCards } from '@guaranix/db/schema';
import { PAYMENT_PROVIDERS, type PaymentProviderName } from '@guaranix/shared/domain';
import type {
  connectPaymentAccountSchema,
  updatePaymentAccountSchema,
} from '@guaranix/shared/schemas';
import { and, eq, ne } from 'drizzle-orm';
import type { z } from 'zod';
import { recordAudit } from './audit';
import {
  callPaymentProvider,
  findPaymentAccount,
  type PaymentAccountRow,
  type PaymentRuntime,
  providerAllowed,
  sealPrivateKey,
  webhookUrlFor,
} from './card-payment-runtime';
import { MANAGER_ROLES, assertRole, type ServiceContext } from './context';
import { boxFeatureState } from './feature-access';
import { conflict, notFound, unprocessable } from './errors';

type ConnectInput = z.output<typeof connectPaymentAccountSchema>;
type UpdateInput = z.output<typeof updatePaymentAccountSchema>;

const OWNER_ONLY = ['box_owner'] as const;

/** What the panel shows: never the private key, only its last four characters. */
export function accountView(runtime: PaymentRuntime, account: PaymentAccountRow) {
  return {
    provider: account.provider,
    environment: account.environment,
    publicKeyHint: secretHint(account.publicKey),
    privateKeyHint: account.privateKeyHint,
    autopayEnabled: account.autopayEnabled,
    connected: account.disconnectedAt === null,
    webhookUrl: webhookUrlFor(runtime, account.id),
    updatedAt: account.updatedAt,
  };
}

/** The box's payment settings: whether its plan includes card payments, and its account. */
export async function getPaymentSettings(context: ServiceContext, runtime: PaymentRuntime) {
  assertRole(context.auth.role, MANAGER_ROLES);
  const feature = await boxFeatureState(
    context.transaction,
    context.auth.boxId,
    'card_payments',
    context.now,
  );
  const account = await findPaymentAccount(context.transaction, context.auth.boxId);
  return {
    included: feature.effective.enabled,
    secretsReady: Boolean(runtime.secretsKey),
    providers: PAYMENT_PROVIDERS.filter((provider) => providerAllowed(runtime, provider)),
    account: account ? accountView(runtime, account) : null,
  };
}

async function hasPendingAttempts(context: ServiceContext, accountId: string) {
  const [pending] = await context.transaction
    .select({ id: paymentAttempts.id })
    .from(paymentAttempts)
    .where(and(eq(paymentAttempts.accountId, accountId), eq(paymentAttempts.status, 'pending')))
    .limit(1);
  return Boolean(pending);
}

/** Cards saved on a processor account the box no longer uses can't be charged. */
async function removeCardsOf(context: ServiceContext, accountId: string) {
  await context.transaction
    .update(savedCards)
    .set({ status: 'removed', removedAt: context.now })
    .where(and(eq(savedCards.accountId, accountId), ne(savedCards.status, 'removed')));
}

/**
 * Connects (or replaces the keys of) the box's own processor account. Only
 * the owner: it decides where the box's money goes. The keys are tried with
 * the processor before they are saved, and the private key is sealed.
 */
export async function connectPaymentAccount(
  context: ServiceContext,
  runtime: PaymentRuntime,
  input: ConnectInput,
) {
  assertRole(context.auth.role, OWNER_ONLY);
  const feature = await boxFeatureState(
    context.transaction,
    context.auth.boxId,
    'card_payments',
    context.now,
  );
  if (!feature.effective.enabled) throw unprocessable('feature_not_included');
  if (!providerAllowed(runtime, input.provider))
    throw unprocessable('payment_provider_unavailable');
  const encryptedPrivateKey = await sealPrivateKey(
    runtime,
    context.auth.boxId,
    input.provider,
    input.privateKey,
  );
  await callPaymentProvider(() => runtime.factory(input).verifyCredentials());

  const existing = await findPaymentAccount(context.transaction, context.auth.boxId);
  const values = {
    provider: input.provider,
    environment: input.environment,
    publicKey: input.publicKey,
    encryptedPrivateKey,
    privateKeyHint: secretHint(input.privateKey),
    autopayEnabled: input.autopayEnabled,
    connectedByUserId: context.auth.userId,
    disconnectedAt: null,
  };
  let account: PaymentAccountRow | undefined;
  if (existing) {
    const switching =
      existing.provider !== input.provider || existing.environment !== input.environment;
    if (switching) {
      // Pending orders must settle on the account that started them.
      if (await hasPendingAttempts(context, existing.id))
        throw conflict('payment_attempts_pending');
      await removeCardsOf(context, existing.id);
    }
    [account] = await context.transaction
      .update(paymentAccounts)
      .set(values)
      .where(eq(paymentAccounts.id, existing.id))
      .returning();
  } else {
    [account] = await context.transaction
      .insert(paymentAccounts)
      .values({ ...values, boxId: context.auth.boxId })
      .returning();
  }
  if (!account) throw new Error('Payment account was not saved');
  await recordAudit(context, {
    action: 'payment_account.connected',
    entityType: 'payment_account',
    entityId: account.id,
    changes: {
      provider: account.provider,
      environment: account.environment,
      privateKeyHint: account.privateKeyHint,
      autopayEnabled: account.autopayEnabled,
      ...(existing && { previousProvider: existing.provider }),
    },
  });
  return accountView(runtime, account);
}

async function connectedAccount(context: ServiceContext) {
  const account = await findPaymentAccount(context.transaction, context.auth.boxId);
  if (!account || account.disconnectedAt) throw notFound('payment_account');
  return account;
}

/** Turns automatic charges on or off for the whole box. */
export async function updatePaymentAccount(
  context: ServiceContext,
  runtime: PaymentRuntime,
  input: UpdateInput,
) {
  assertRole(context.auth.role, MANAGER_ROLES);
  const account = await connectedAccount(context);
  const [updated] = await context.transaction
    .update(paymentAccounts)
    .set({ autopayEnabled: input.autopayEnabled })
    .where(eq(paymentAccounts.id, account.id))
    .returning();
  if (!updated) throw notFound('payment_account');
  await recordAudit(context, {
    action: 'payment_account.updated',
    entityType: 'payment_account',
    entityId: account.id,
    changes: { autopayEnabled: { from: account.autopayEnabled, to: input.autopayEnabled } },
  });
  return accountView(runtime, updated);
}

/**
 * Stops card payments. Saved cards stop being charged; the account row and
 * its sealed key stay so earlier orders can still be confirmed or refunded.
 */
export async function disconnectPaymentAccount(context: ServiceContext, runtime: PaymentRuntime) {
  assertRole(context.auth.role, OWNER_ONLY);
  const account = await connectedAccount(context);
  await removeCardsOf(context, account.id);
  const [updated] = await context.transaction
    .update(paymentAccounts)
    .set({ autopayEnabled: false, disconnectedAt: context.now })
    .where(eq(paymentAccounts.id, account.id))
    .returning();
  if (!updated) throw notFound('payment_account');
  await recordAudit(context, {
    action: 'payment_account.disconnected',
    entityType: 'payment_account',
    entityId: account.id,
    changes: { provider: account.provider satisfies PaymentProviderName },
  });
  return accountView(runtime, updated);
}
