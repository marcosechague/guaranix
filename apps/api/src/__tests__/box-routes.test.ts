import { boxUsers, classes, members, programs } from '@guaranix/db/schema';
import { withSystemScope } from '@guaranix/db';
import type { BoxRole, Session } from '@guaranix/shared';
import { addDays, calendarDateIn } from '@guaranix/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness, signedUpBrowser, testEnv } from './harness';

let harness: Harness;
type SignedIn = Awaited<ReturnType<typeof userWithRole>>;
let as: Record<BoxRole | 'planless', SignedIn>;

beforeAll(async () => {
  harness = await createHarness();
  // Signing up hashes a password, which is slow on purpose: one user per role, shared.
  const entries = await Promise.all(
    (['box_owner', 'box_admin', 'coach', 'reception', 'member'] as const).map(
      async (role) => [role, await userWithRole(role)] as const,
    ),
  );
  as = { ...Object.fromEntries(entries), planless: await userWithRole('member') } as typeof as;
}, 60_000);

afterAll(async () => {
  await harness.close();
});

/** A logged-in user with `role` in a box; members also get a member profile. */
async function userWithRole(role: BoxRole, boxId = harness.boxA.boxId) {
  const signed = await signedUpBrowser(harness);
  const userId = signed.session.user.id;
  await harness.database.insert(boxUsers).values({ boxId, userId, role });
  let memberId: string | null = null;
  if (role === 'member') {
    const [member] = await harness.database
      .insert(members)
      .values({ boxId, userId, firstName: 'Socia', lastName: 'Ruta' })
      .returning({ id: members.id });
    memberId = member?.id ?? null;
  }
  const response = await signed.browser.post('/auth/login', {
    email: signed.email,
    password: signed.password,
    captchaToken: 'ok',
  });
  return { ...signed, memberId, session: (await response.json()) as Session };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

const today = () => calendarDateIn('America/Asuncion', new Date());

async function crossfitOf(boxId: string) {
  const rows = await withSystemScope(harness.database, (transaction) =>
    transaction.select().from(programs).where(eq(programs.boxId, boxId)),
  );
  const program = rows.find((row) => row.name === 'CrossFit');
  if (!program) throw new Error('CrossFit program missing');
  return program.id;
}

async function classTomorrow(boxId: string, capacity = 10) {
  const startsAt = new Date(Date.now() + 26 * 60 * 60 * 1000);
  const programId = await crossfitOf(boxId);
  const [classRow] = await withSystemScope(harness.database, (transaction) =>
    transaction
      .insert(classes)
      .values({
        boxId,
        programId,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
        capacity,
      })
      .returning(),
  );
  if (!classRow) throw new Error('Class was not created');
  return classRow;
}

describe('box API routes', () => {
  it('require a session', async () => {
    const response = await harness.app.request('/box/members', {}, testEnv);
    expect(response.status).toBe(401);
  });

  it.each([
    ['member', 'get', '/box/members'],
    ['coach', 'post', '/box/members'],
    ['reception', 'post', '/box/plans'],
    ['member', 'get', '/box/schedules'],
    ['coach', 'post', '/box/classes/generate'],
    ['box_owner', 'get', '/box/me'],
  ] as const)('deny %s on %s %s', async (role, method, path) => {
    const { browser } = as[role];
    const response = method === 'get' ? await browser.get(path) : await browser.post(path, {});
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
  });

  it('reject invalid input and non-UUID ids', async () => {
    const { browser } = as.reception;
    const invalid = await browser.post('/box/members', { firstName: '' });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: 'invalid_input' });
    const badId = await browser.get('/box/members/not-a-uuid');
    expect(badId.status).toBe(404);
    expect(await badId.json()).toEqual({ error: 'member_not_found' });
  });

  it("don't reach another box's data", async () => {
    const { browser } = as.box_owner;
    const [foreign] = await withSystemScope(harness.database, (transaction) =>
      transaction.select().from(members).where(eq(members.boxId, harness.boxB.boxId)).limit(1),
    );
    const response = await browser.get(`/box/members/${foreign?.id}`);
    expect(response.status).toBe(404);
    const listed = await json<{ members: { boxId: string }[] }>(await browser.get('/box/members'));
    expect(listed.members.every((member) => member.boxId === harness.boxA.boxId)).toBe(true);
  });

  it('roll back the whole request when a rule fails', async () => {
    const { browser } = as.reception;
    const created = await browser.post('/box/members', {
      firstName: 'Doble',
      lastName: 'Cédula',
      documentNumber: '9876543',
    });
    expect(created.status).toBe(201);
    const repeated = await browser.post('/box/members', {
      firstName: 'Otra',
      lastName: 'Persona',
      documentNumber: '9876543',
    });
    expect(repeated.status).toBe(409);
    expect(await repeated.json()).toEqual({ error: 'member_document_taken' });
  });
});

describe('selling a plan and booking, end to end', () => {
  it('owner creates a plan, reception sells it, the member books and cancels', async () => {
    const { box_owner: owner, reception, member } = as;

    const planResponse = await owner.browser.post('/box/plans', {
      name: 'Pack 4 rutas',
      kind: 'class_pack',
      classCount: 4,
      priceGs: 160_000,
      durationDays: 30,
    });
    expect(planResponse.status).toBe(201);
    const { plan } = await json<{ plan: { id: string } }>(planResponse);

    const sale = await reception.browser.post(`/box/members/${member.memberId}/plans`, {
      planId: plan.id,
      startsOn: today(),
    });
    expect(sale.status).toBe(201);
    expect(await sale.json()).toMatchObject({
      memberPlan: { priceGs: 160_000, classesRemaining: 4, endsOn: addDays(today(), 29) },
    });

    const classRow = await classTomorrow(harness.boxA.boxId);
    const booked = await member.browser.post('/box/bookings', { classId: classRow.id });
    expect(booked.status).toBe(201);
    const { booking } = await json<{ booking: { id: string; status: string } }>(booked);
    expect(booking.status).toBe('booked');

    const listing = await json<{
      classes: { id: string; ownBooking: { status: string } | null }[];
    }>(await member.browser.get(`/box/classes?from=${today()}&to=${addDays(today(), 2)}`));
    expect(listing.classes.find((row) => row.id === classRow.id)?.ownBooking?.status).toBe(
      'booked',
    );

    const myPlans = await json<{ plans: { classesRemaining: number }[] }>(
      await member.browser.get('/box/me/plans'),
    );
    expect(myPlans.plans[0]?.classesRemaining).toBe(3);

    const cancelled = await member.browser.post(`/box/bookings/${booking.id}/cancel`, {});
    expect(await cancelled.json()).toMatchObject({
      booking: { status: 'cancelled' },
      promoted: [],
    });
    const afterCancel = await json<{ plans: { classesRemaining: number }[] }>(
      await member.browser.get('/box/me/plans'),
    );
    expect(afterCancel.plans[0]?.classesRemaining).toBe(4);
  });

  it('a member without a plan gets a clear reason', async () => {
    const member = as.planless;
    const classRow = await classTomorrow(harness.boxA.boxId);
    const response = await member.browser.post('/box/bookings', { classId: classRow.id });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: 'no_valid_plan' });
  });

  it("a member can't book a class of another box", async () => {
    const member = as.planless;
    const foreignClass = await classTomorrow(harness.boxB.boxId);
    const response = await member.browser.post('/box/bookings', { classId: foreignClass.id });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'class_not_found' });
  });

  it('managers generate classes and coaches see the roster', async () => {
    const { box_owner: owner, coach } = as;
    const generated = await owner.browser.post('/box/classes/generate', {
      from: addDays(today(), 20),
      days: 7,
    });
    expect(generated.status).toBe(200);
    expect((await json<{ created: number }>(generated)).created).toBeGreaterThan(0);
    const classRow = await classTomorrow(harness.boxA.boxId);
    const roster = await coach.browser.get(`/box/classes/${classRow.id}/roster`);
    expect(await roster.json()).toMatchObject({ class: { id: classRow.id }, roster: [] });
  });
});

describe('WODs and results, end to end', () => {
  it('coach publishes a WOD, the member logs a result and sees the whiteboard', async () => {
    const { coach, member } = as;
    const programId = await crossfitOf(harness.boxA.boxId);
    const date = addDays(today(), 40);
    const created = await coach.browser.post('/box/workouts', {
      programId,
      workoutDate: date,
      title: 'Cindy',
      components: [
        {
          position: 0,
          kind: 'metcon',
          description: '20 min AMRAP: 5 pull-ups, 10 push-ups, 15 squats',
          scoreType: 'rounds_reps',
          timerType: 'amrap',
          timeCapSeconds: 1200,
        },
      ],
    });
    expect(created.status).toBe(201);
    const { workout } = await json<{ workout: { id: string; components: { id: string }[] } }>(
      created,
    );
    const componentId = workout.components[0]?.id ?? '';

    const hidden = await json<{ workouts: unknown[] }>(
      await member.browser.get(`/box/workouts?date=${date}`),
    );
    expect(hidden.workouts).toEqual([]);
    expect((await member.browser.post('/box/workouts', {})).status).toBe(403);

    await coach.browser.post(`/box/workouts/${workout.id}/publish`, {});
    const logged = await member.browser.post('/box/results', {
      componentId,
      scaling: 'rx',
      rounds: 18,
      reps: 7,
    });
    expect(logged.status).toBe(201);
    const board = await json<{ entries: { rounds: number; reps: number }[] }>(
      await member.browser.get(`/box/components/${componentId}/leaderboard`),
    );
    expect(board.entries).toEqual([expect.objectContaining({ rounds: 18, reps: 7 })]);
  });
});

describe('payments, debtors and dashboard', () => {
  it('a member reports a transfer, reception confirms it, the owner sees the money', async () => {
    const { box_owner: owner, reception, planless: member, coach } = as;
    const charge = await reception.browser.post('/box/charges', {
      memberId: member.memberId,
      description: 'Cuota',
      amountGs: 250_000,
      dueOn: addDays(today(), -2),
    });
    expect(charge.status).toBe(201);
    const chargeId = (await json<{ charge: { id: string } }>(charge)).charge.id;

    const debtors = await json<{ debtors: { memberId: string; owedGs: number }[] }>(
      await reception.browser.get('/box/reports/debtors'),
    );
    expect(debtors.debtors.find((row) => row.memberId === member.memberId)?.owedGs).toBe(250_000);

    const reported = await member.browser.post('/box/payments', {
      memberId: member.memberId,
      chargeId,
      amountGs: 250_000,
      method: 'bank_transfer',
      paidAt: new Date().toISOString(),
      reference: 'ROUTE-1',
      receiptFileKey: 'receipts/route.jpg',
    });
    expect(reported.status).toBe(201);
    const paymentId = (await json<{ payment: { id: string; status: string } }>(reported)).payment
      .id;

    const review = await reception.browser.post(`/box/payments/${paymentId}/review`, {
      status: 'confirmed',
    });
    expect(await review.json()).toMatchObject({ payment: { status: 'confirmed' } });
    const account = await json<{ outstandingGs: number }>(
      await member.browser.get('/box/me/account'),
    );
    expect(account.outstandingGs).toBe(0);

    const figures = await owner.browser.get(`/box/reports/dashboard?from=${today()}&to=${today()}`);
    expect(figures.status).toBe(200);
    expect(
      (await json<{ money: { collectedGs: number } }>(figures)).money.collectedGs,
    ).toBeGreaterThanOrEqual(250_000);
    expect(
      (await reception.browser.get(`/box/reports/dashboard?from=${today()}&to=${today()}`)).status,
    ).toBe(403);
    expect((await coach.browser.get('/box/payments')).status).toBe(403);
  });
});
