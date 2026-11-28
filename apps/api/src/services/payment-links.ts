import {
  type SchemaDatabase,
  type ScopedTransaction,
  withBoxScope,
  withSystemScope,
} from '@guaranix/db';
import { boxes, charges, members, paymentAttempts, paymentLinks } from '@guaranix/db/schema';
import { type HostedCheckout, PaymentProviderError } from '@guaranix/payments';
import { formatGuarani, t, whatsappLink } from '@guaranix/shared';
import { and, desc, eq, gt } from 'drizzle-orm';
import { randomToken, sha256 } from '../lib/crypto';
import {
  activePaymentAccount,
  memberAppUrl,
  type PaymentRuntime,
  providerForAccount,
} from './card-payment-runtime';
import { confirmedPaidByCharge } from './charges';
import { FRONT_DESK_ROLES, assertRole, type ServiceContext } from './context';
import { notFound, unprocessable } from './errors';

/** A week: long enough to pay after payday, short enough that a leaked link soon dies. */
const LINK_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export interface CreatedPaymentLink {
  linkId: string;
  url: string;
  expiresAt: Date;
  whatsappUrl: string | null;
}

/** Guaraníes still owed on a charge, counting only confirmed payments. */
export async function outstandingOf(transaction: ScopedTransaction, chargeId: string) {
  const [charge] = await transaction.select().from(charges).where(eq(charges.id, chargeId));
  if (!charge) throw notFound('charge');
  const paid = (await confirmedPaidByCharge({ transaction }, [charge.id])).get(charge.id) ?? 0;
  return {
    charge,
    outstandingGs: charge.status === 'open' ? Math.max(charge.amountGs - paid, 0) : 0,
  };
}

/**
 * A link to pay one charge. Only the SHA-256 of its token is stored: the URL
 * itself works as a password and lives only in the message sent to the member.
 */
export async function createPaymentLink(
  transaction: ScopedTransaction,
  runtime: PaymentRuntime,
  options: { boxId: string; chargeId: string; now: Date; createdByUserId: string | null },
): Promise<CreatedPaymentLink> {
  const { charge, outstandingGs } = await outstandingOf(transaction, options.chargeId);
  if (outstandingGs === 0) throw unprocessable('charge_not_open');
  const token = randomToken();
  const expiresAt = new Date(options.now.getTime() + LINK_LIFETIME_MS);
  const [link] = await transaction
    .insert(paymentLinks)
    .values({
      boxId: options.boxId,
      chargeId: charge.id,
      memberId: charge.memberId,
      tokenHash: await sha256(token),
      expiresAt,
      createdByUserId: options.createdByUserId,
    })
    .returning();
  if (!link) throw new Error('Payment link insert returned no row');
  const [member] = await transaction
    .select({ firstName: members.firstName, phone: members.phone })
    .from(members)
    .where(eq(members.id, charge.memberId));
  const url = memberAppUrl(runtime, `/pagar/${token}`);
  const message = t('cardPayments.whatsappMessage', {
    name: member?.firstName ?? '',
    description: charge.description,
    amount: formatGuarani(outstandingGs),
    url,
  });
  return { linkId: link.id, url, expiresAt, whatsappUrl: whatsappLink(member?.phone, message) };
}

/** Front desk makes a link to send by WhatsApp to someone who owes. */
export async function createPaymentLinkForCharge(
  context: ServiceContext,
  runtime: PaymentRuntime,
  chargeId: string,
) {
  assertRole(context.auth.role, FRONT_DESK_ROLES);
  const account = await activePaymentAccount(
    context.transaction,
    runtime,
    context.auth.boxId,
    context.now,
  );
  if (!account) throw unprocessable('card_payments_unavailable');
  return createPaymentLink(context.transaction, runtime, {
    boxId: context.auth.boxId,
    chargeId,
    now: context.now,
    createdByUserId: context.auth.userId,
  });
}

/** Which box a token belongs to. The only unscoped read; everything after runs under RLS. */
async function boxOfLink(database: SchemaDatabase, token: string) {
  const tokenHash = await sha256(token);
  const [link] = await withSystemScope(database, (transaction) =>
    transaction
      .select({ id: paymentLinks.id, boxId: paymentLinks.boxId })
      .from(paymentLinks)
      .where(eq(paymentLinks.tokenHash, tokenHash)),
  );
  if (!link) throw notFound('payment_link');
  return link;
}

async function linkState(transaction: ScopedTransaction, linkId: string, now: Date) {
  const [row] = await transaction
    .select({ link: paymentLinks, boxName: boxes.name, firstName: members.firstName })
    .from(paymentLinks)
    .innerJoin(boxes, eq(boxes.id, paymentLinks.boxId))
    .innerJoin(members, eq(members.id, paymentLinks.memberId))
    .where(eq(paymentLinks.id, linkId));
  if (!row) throw notFound('payment_link');
  const { charge, outstandingGs } = await outstandingOf(transaction, row.link.chargeId);
  const status =
    charge.status === 'paid' || (charge.status === 'open' && outstandingGs === 0)
      ? 'paid'
      : charge.status === 'void'
        ? 'void'
        : row.link.expiresAt <= now
          ? 'expired'
          : 'payable';
  return { ...row, charge, outstandingGs, status } as const;
}

/** What the payment page shows. No member data beyond the first name. */
export async function describePaymentLink(database: SchemaDatabase, token: string, now: Date) {
  const { id, boxId } = await boxOfLink(database, token);
  return withBoxScope(database, { boxId }, async (transaction) => {
    const state = await linkState(transaction, id, now);
    return {
      status: state.status,
      boxName: state.boxName,
      firstName: state.firstName,
      description: state.charge.description,
      amountGs: state.outstandingGs,
      dueOn: state.charge.dueOn,
      expiresAt: state.link.expiresAt,
    };
  });
}

/**
 * Opens the processor's payment form for the link. The attempt (with its
 * order number) is committed before the processor is called, so whatever
 * happens next the confirmation webhook finds it.
 */
export async function startLinkCheckout(
  database: SchemaDatabase,
  runtime: PaymentRuntime,
  token: string,
  now: Date,
): Promise<{ checkout: HostedCheckout }> {
  const { id, boxId } = await boxOfLink(database, token);
  const prepared = await withBoxScope(database, { boxId }, async (transaction) => {
    const state = await linkState(transaction, id, now);
    if (state.status !== 'payable') throw unprocessable(`payment_link_${state.status}`);
    const account = await activePaymentAccount(transaction, runtime, boxId, now);
    if (!account) throw unprocessable('card_payments_unavailable');
    const [attempt] = await transaction
      .insert(paymentAttempts)
      .values({
        boxId,
        accountId: account.id,
        chargeId: state.charge.id,
        memberId: state.charge.memberId,
        kind: 'link',
        paymentLinkId: id,
        amountGs: state.outstandingGs,
        createdAt: now,
      })
      .returning();
    if (!attempt) throw new Error('Payment attempt insert returned no row');
    return { attempt, account, description: state.charge.description };
  });

  const provider = await providerForAccount(runtime, prepared.account);
  const returnUrl = memberAppUrl(runtime, `/pagar/${token}`);
  let checkout: HostedCheckout;
  try {
    checkout = await provider.startHostedPayment({
      orderNumber: prepared.attempt.orderNumber,
      amountGs: prepared.attempt.amountGs,
      description: prepared.description,
      returnUrl,
      cancelUrl: returnUrl,
    });
  } catch (error) {
    await withBoxScope(database, { boxId }, (transaction) =>
      transaction
        .update(paymentAttempts)
        .set({ status: 'failed', declineCode: 'checkout_not_started', resolvedAt: now })
        .where(eq(paymentAttempts.id, prepared.attempt.id)),
    );
    if (error instanceof PaymentProviderError) throw unprocessable('payment_provider_down');
    throw error;
  }
  await withBoxScope(database, { boxId }, (transaction) =>
    transaction
      .update(paymentAttempts)
      .set({ checkoutRef: checkout.processId })
      .where(eq(paymentAttempts.id, prepared.attempt.id)),
  );
  return { checkout };
}

/** The link attempt the mock checkout is simulating, for the dev-only simulator. */
export async function latestLinkAttempt(database: SchemaDatabase, token: string, now: Date) {
  const { id, boxId } = await boxOfLink(database, token);
  return withBoxScope(database, { boxId }, async (transaction) => {
    const [attempt] = await transaction
      .select()
      .from(paymentAttempts)
      .where(
        and(
          eq(paymentAttempts.paymentLinkId, id),
          eq(paymentAttempts.status, 'pending'),
          gt(paymentAttempts.createdAt, new Date(now.getTime() - 60 * 60 * 1000)),
        ),
      )
      .orderBy(desc(paymentAttempts.createdAt))
      .limit(1);
    if (!attempt) throw notFound('payment_attempt');
    return { attempt, boxId };
  });
}
