import { withSystemScope } from '@guaranix/db';
import { boxUsers, charges, members, users } from '@guaranix/db/schema';
import { type BoxRole, calendarDateIn } from '@guaranix/shared';
import { eq } from 'drizzle-orm';
import { paymentRuntimeFor } from '../services/card-payment-runtime';
import { type Harness, signedUpBrowser, testEnv } from './harness';

/** A signed-up user with `role` in the box, logged in again so the session has the box. */
export async function userIn(harness: Harness, role: BoxRole, boxId = harness.boxA.boxId) {
  const signed = await signedUpBrowser(harness);
  const userId = signed.session.user.id;
  await harness.database.insert(boxUsers).values({ boxId, userId, role });
  let memberId: string | null = null;
  if (role === 'member') {
    const [member] = await harness.database
      .insert(members)
      .values({ boxId, userId, firstName: 'Ana', lastName: 'Benítez', phone: '0981 123 456' })
      .returning({ id: members.id });
    memberId = member?.id ?? null;
  }
  await signed.browser.post('/auth/login', {
    email: signed.email,
    password: signed.password,
    captchaToken: 'ok',
  });
  return { browser: signed.browser, userId, memberId: memberId ?? '' };
}

/** Makes the platform admin and turns `card_payments` on for a box. */
export async function enableCardPayments(harness: Harness, boxId: string) {
  const admin = await signedUpBrowser(harness);
  await harness.database
    .update(users)
    .set({ isPlatformAdmin: true })
    .where(eq(users.id, admin.session.user.id));
  const response = await admin.browser.put(`/platform/boxes/${boxId}/features/card_payments`, {
    enabled: true,
    monthlyLimit: null,
  });
  if (response.status !== 200) throw new Error(`Feature override failed: ${response.status}`);
}

export const MOCK_ACCOUNT = {
  provider: 'mock',
  environment: 'sandbox',
  publicKey: 'pk-mock-public-0001',
  privateKey: 'sk-mock-private-0001', // secret-scan-ignore: fake key for tests
  autopayEnabled: true,
} as const;

export const today = (now = new Date()) => calendarDateIn('America/Asuncion', now);

/** An open charge for the member, due `dueOn` (today by default). */
export async function openCharge(
  harness: Harness,
  memberId: string,
  amountGs: number,
  dueOn = today(),
  boxId = harness.boxA.boxId,
) {
  const [charge] = await withSystemScope(harness.database, (transaction) =>
    transaction
      .insert(charges)
      .values({ boxId, memberId, description: 'Cuota mensual', amountGs, dueOn })
      .returning(),
  );
  if (!charge) throw new Error('charge not created');
  return charge;
}

export const runtimeOf = (harness: Harness) =>
  paymentRuntimeFor(testEnv, { paymentProviderFactory: harness.payments.factory });

export const systemRows = <T>(harness: Harness, work: Parameters<typeof withSystemScope<T>>[1]) =>
  withSystemScope(harness.database, work);
