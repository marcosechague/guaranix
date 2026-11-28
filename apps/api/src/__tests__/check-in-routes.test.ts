import { boxUsers, boxes, classes, members, programs } from '@guaranix/db/schema';
import { withSystemScope } from '@guaranix/db';
import { calendarDateIn, type BoxRole } from '@guaranix/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness, signedUpBrowser } from './harness';

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness();
  await withSystemScope(harness.database, (transaction) =>
    transaction
      .update(boxes)
      .set({ checkInDeskEnabled: true })
      .where(eq(boxes.id, harness.boxA.boxId)),
  );
}, 60_000);

afterAll(async () => {
  await harness.close();
});

async function userWithRole(role: BoxRole) {
  const signed = await signedUpBrowser(harness);
  const userId = signed.session.user.id;
  const boxId = harness.boxA.boxId;
  await harness.database.insert(boxUsers).values({ boxId, userId, role });
  const [member] =
    role === 'member'
      ? await harness.database
          .insert(members)
          .values({ boxId, userId, firstName: 'Socia', lastName: 'Puerta' })
          .returning({ id: members.id })
      : [];
  await signed.browser.post('/auth/login', {
    email: signed.email,
    password: signed.password,
    captchaToken: 'ok',
  });
  return { ...signed, memberId: member?.id ?? null };
}

async function classInTenMinutes(): Promise<string> {
  const boxId = harness.boxA.boxId;
  const [program] = await withSystemScope(harness.database, (transaction) =>
    transaction.select().from(programs).where(eq(programs.boxId, boxId)).limit(1),
  );
  if (!program) throw new Error('Program missing');
  const startsAt = new Date(Date.now() + 10 * 60 * 1000);
  const [created] = await withSystemScope(harness.database, (transaction) =>
    transaction
      .insert(classes)
      .values({
        boxId,
        programId: program.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
        capacity: 20,
      })
      .returning({ id: classes.id }),
  );
  if (!created) throw new Error('Class missing');
  return created.id;
}

describe('QR check-in routes', () => {
  it('the member shows a pass, the entrance lets them in once', async () => {
    const owner = await userWithRole('box_owner');
    const reception = await userWithRole('reception');
    const member = await userWithRole('member');
    const plan = await owner.browser.post('/box/plans', {
      name: 'Libre puerta',
      kind: 'unlimited',
      priceGs: 300_000,
      durationDays: 30,
    });
    const { plan: created } = (await plan.json()) as { plan: { id: string } };
    const sale = await reception.browser.post(`/box/members/${member.memberId}/plans`, {
      planId: created.id,
      startsOn: calendarDateIn('America/Asuncion', new Date()),
    });
    expect(sale.status).toBe(201);
    await classInTenMinutes();

    const passResponse = await member.browser.get('/box/me/check-in-pass');
    expect(passResponse.status).toBe(200);
    const { pass } = (await passResponse.json()) as { pass: { pass: string; expiresAt: string } };
    expect(pass.pass).toMatch(/^gx1\./);

    const denied = await member.browser.post('/box/check-ins', { pass: pass.pass });
    expect(denied.status).toBe(403);
    expect((await reception.browser.get('/box/me/check-in-pass')).status).toBe(403);

    const first = await reception.browser.post('/box/check-ins', { pass: pass.pass });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({
      result: { outcome: 'checked_in', member: { id: member.memberId, firstName: 'Socia' } },
    });
    const second = await reception.browser.post('/box/check-ins', { pass: pass.pass });
    expect(await second.json()).toMatchObject({ result: { outcome: 'already_checked_in' } });

    const garbage = await reception.browser.post('/box/check-ins', { pass: 'hola mundo' });
    expect(garbage.status).toBe(400);
  });

  it('the coach adds someone who came without booking, and sees them on the list', async () => {
    const owner = await userWithRole('box_owner');
    const coach = await userWithRole('coach');
    const member = await userWithRole('member');
    const plan = await owner.browser.post('/box/plans', {
      name: 'Libre coach',
      kind: 'unlimited',
      priceGs: 300_000,
      durationDays: 30,
    });
    const { plan: created } = (await plan.json()) as { plan: { id: string } };
    await owner.browser.post(`/box/members/${member.memberId}/plans`, {
      planId: created.id,
      startsOn: calendarDateIn('America/Asuncion', new Date()),
    });
    const classId = await classInTenMinutes();

    const bad = await coach.browser.post(`/box/classes/${classId}/walk-ins`, { memberId: 'x' });
    expect(bad.status).toBe(400);
    const walkIn = await coach.browser.post(`/box/classes/${classId}/walk-ins`, {
      memberId: member.memberId,
    });
    expect(walkIn.status).toBe(200);
    expect(await walkIn.json()).toMatchObject({ result: { outcome: 'checked_in', walkIn: true } });
    expect(
      (await member.browser.post(`/box/classes/${classId}/walk-ins`, { memberId: member.memberId }))
        .status,
    ).toBe(403);

    const roster = (await (await coach.browser.get(`/box/classes/${classId}/roster`)).json()) as {
      roster: { memberId: string; status: string; owedGs: number }[];
    };
    expect(roster.roster).toContainEqual(
      expect.objectContaining({ memberId: member.memberId, status: 'attended' }),
    );
  });
});
