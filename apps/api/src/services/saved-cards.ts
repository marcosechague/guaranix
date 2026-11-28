import { paymentCustomers, savedCards } from '@guaranix/db/schema';
import type { HostedCheckout } from '@guaranix/payments';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { recordAudit } from './audit';
import {
  activePaymentAccount,
  callPaymentProvider,
  memberAppUrl,
  type PaymentAccountRow,
  type PaymentRuntime,
  providerForAccount,
} from './card-payment-runtime';
import { FRONT_DESK_ROLES, assertRole, type ServiceContext } from './context';
import { notFound, unprocessable } from './errors';
import { getMember, getOwnMember } from './members';

export type SavedCardRow = typeof savedCards.$inferSelect;

/** Only what a screen needs: brand, last four, expiry. The processor reference stays inside. */
export function cardView(card: SavedCardRow) {
  return {
    id: card.id,
    status: card.status,
    brand: card.brand,
    last4: card.last4,
    expiresOn: card.expiresOn,
    autopayConsentAt: card.autopayConsentAt,
    activatedAt: card.activatedAt,
  };
}

async function requireAccount(context: ServiceContext, runtime: PaymentRuntime) {
  const account = await activePaymentAccount(
    context.transaction,
    runtime,
    context.auth.boxId,
    context.now,
  );
  if (!account) throw unprocessable('card_payments_unavailable');
  return account;
}

async function customerFor(
  context: ServiceContext,
  runtime: PaymentRuntime,
  account: PaymentAccountRow,
  memberId: string,
) {
  const [existing] = await context.transaction
    .select()
    .from(paymentCustomers)
    .where(
      and(eq(paymentCustomers.accountId, account.id), eq(paymentCustomers.memberId, memberId)),
    );
  if (existing) return existing;
  const [created] = await context.transaction
    .insert(paymentCustomers)
    .values({ boxId: context.auth.boxId, accountId: account.id, memberId })
    .returning();
  if (!created) throw new Error('Payment customer insert returned no row');
  const provider = await providerForAccount(runtime, account);
  await callPaymentProvider(() => provider.createCustomer({ customerRef: created.customerRef }));
  return created;
}

/** The signed-in member's card, and whether the box takes cards at all. */
export async function listOwnCards(context: ServiceContext, runtime: PaymentRuntime) {
  const member = await getOwnMember(context);
  const account = await activePaymentAccount(
    context.transaction,
    runtime,
    context.auth.boxId,
    context.now,
  );
  const cards = account
    ? await context.transaction
        .select()
        .from(savedCards)
        .where(
          and(
            eq(savedCards.memberId, member.id),
            eq(savedCards.accountId, account.id),
            eq(savedCards.status, 'active'),
          ),
        )
    : [];
  return {
    available: Boolean(account),
    autopayEnabled: account?.autopayEnabled ?? false,
    cards: cards.map(cardView),
  };
}

/**
 * Starts saving a card: the member accepted automatic charges, and types the
 * card on the processor's own form. Nothing is active until `confirmOwnCard`
 * checks with the processor that the card was really saved.
 */
export async function startOwnCardRegistration(
  context: ServiceContext,
  runtime: PaymentRuntime,
): Promise<{ card: ReturnType<typeof cardView>; checkout: HostedCheckout }> {
  const member = await getOwnMember(context);
  const account = await requireAccount(context, runtime);
  const customer = await customerFor(context, runtime, account, member.id);
  const [card] = await context.transaction
    .insert(savedCards)
    .values({
      boxId: context.auth.boxId,
      accountId: account.id,
      customerId: customer.id,
      memberId: member.id,
      autopayConsentAt: context.now,
    })
    .returning();
  if (!card) throw new Error('Saved card insert returned no row');
  const provider = await providerForAccount(runtime, account);
  const checkout = await callPaymentProvider(() =>
    provider.startCardRegistration({
      customerRef: customer.customerRef,
      cardRef: card.cardRef,
      email: member.email,
      phone: member.phone,
      returnUrl: memberAppUrl(runtime, `/cuota/tarjeta?card=${card.id}`),
    }),
  );
  return { card: cardView(card), checkout };
}

async function ownCard(context: ServiceContext, cardId: string) {
  const member = await getOwnMember(context);
  const [card] = await context.transaction
    .select({ card: savedCards, customerRef: paymentCustomers.customerRef })
    .from(savedCards)
    .innerJoin(paymentCustomers, eq(paymentCustomers.id, savedCards.customerId))
    .where(and(eq(savedCards.id, cardId), eq(savedCards.memberId, member.id)));
  if (!card || card.card.status === 'removed') throw notFound('saved_card');
  return card;
}

/**
 * Activates the card the member just saved, once the processor confirms it.
 * It replaces their previous card, which is also deleted at the processor.
 */
export async function confirmOwnCard(
  context: ServiceContext,
  runtime: PaymentRuntime,
  cardId: string,
) {
  const { card, customerRef } = await ownCard(context, cardId);
  if (card.status === 'active') return cardView(card);
  const account = await requireAccount(context, runtime);
  if (card.accountId !== account.id) throw notFound('saved_card');
  const provider = await providerForAccount(runtime, account);
  const registered = await callPaymentProvider(() =>
    provider.findCard({ customerRef, cardRef: card.cardRef }),
  );
  if (!registered) throw unprocessable('card_not_saved');

  const previous = await context.transaction
    .select()
    .from(savedCards)
    .where(
      and(
        eq(savedCards.memberId, card.memberId),
        eq(savedCards.status, 'active'),
        ne(savedCards.id, card.id),
      ),
    );
  if (previous.length > 0) {
    await context.transaction
      .update(savedCards)
      .set({ status: 'removed', removedAt: context.now })
      .where(
        inArray(
          savedCards.id,
          previous.map((old) => old.id),
        ),
      );
  }
  const [active] = await context.transaction
    .update(savedCards)
    .set({
      status: 'active',
      brand: registered.brand,
      last4: registered.last4,
      expiresOn: registered.expiresOn,
      activatedAt: context.now,
    })
    .where(eq(savedCards.id, card.id))
    .returning();
  if (!active) throw notFound('saved_card');
  for (const old of previous) {
    // Best effort: the old card is already out of use here even if the processor is slow.
    await provider.removeCard({ customerRef, cardRef: old.cardRef }).catch(() => undefined);
  }
  await recordAudit(context, {
    action: 'saved_card.added',
    entityType: 'saved_card',
    entityId: active.id,
    changes: { memberId: active.memberId, brand: active.brand, last4: active.last4 },
  });
  return cardView(active);
}

/** The member takes their card out: no more automatic charges. */
export async function removeOwnCard(
  context: ServiceContext,
  runtime: PaymentRuntime,
  cardId: string,
) {
  const { card, customerRef } = await ownCard(context, cardId);
  const account = await activePaymentAccount(
    context.transaction,
    runtime,
    context.auth.boxId,
    context.now,
  );
  if (card.status === 'active' && account?.id === card.accountId) {
    const provider = await providerForAccount(runtime, account);
    await callPaymentProvider(() => provider.removeCard({ customerRef, cardRef: card.cardRef }));
  }
  await context.transaction
    .update(savedCards)
    .set({ status: 'removed', removedAt: context.now })
    .where(eq(savedCards.id, card.id));
  await recordAudit(context, {
    action: 'saved_card.removed',
    entityType: 'saved_card',
    entityId: card.id,
    changes: { memberId: card.memberId, last4: card.last4 },
  });
}

/** Front desk sees whether a member pays automatically, and with which card. */
export async function listMemberCards(context: ServiceContext, memberId: string) {
  assertRole(context.auth.role, FRONT_DESK_ROLES);
  const member = await getMember(context, memberId);
  const cards = await context.transaction
    .select()
    .from(savedCards)
    .where(and(eq(savedCards.memberId, member.id), eq(savedCards.status, 'active')))
    .orderBy(desc(savedCards.activatedAt));
  return cards.map(cardView);
}
