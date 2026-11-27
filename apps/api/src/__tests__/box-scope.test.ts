import { boxUsers, members, users } from '@guaranix/db/schema';
import { withSystemScope } from '@guaranix/db';
import type { Session } from '@guaranix/shared';
import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness, signedUpBrowser } from './harness';

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness();
});

afterAll(async () => {
  await harness.close();
});

/** Signs up a user and gives them `role` in box A, then logs in again so the session picks it up. */
async function userWithRole(role: 'box_owner' | 'coach' | 'member', boxId = harness.boxA.boxId) {
  const signed = await signedUpBrowser(harness);
  await harness.database.insert(boxUsers).values({ boxId, userId: signed.session.user.id, role });
  const response = await signed.browser.post('/auth/login', {
    email: signed.email,
    password: signed.password,
    captchaToken: 'ok',
  });
  return { ...signed, session: (await response.json()) as Session };
}

async function membersIn(boxId: string) {
  const [result] = await withSystemScope(harness.database, (transaction) =>
    transaction.select({ total: count() }).from(members).where(eq(members.boxId, boxId)),
  );
  return result?.total ?? 0;
}

describe('box routes', () => {
  it('need a box in the session', async () => {
    const { browser } = await signedUpBrowser(harness);
    const response = await browser.get('/box/current');
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'not_a_member' });
  });

  it('use the box from the session', async () => {
    const { browser } = await userWithRole('box_owner');
    const response = await browser.get('/box/current');
    expect(await response.json()).toMatchObject({
      box: { id: harness.boxA.boxId, slug: 'box-a' },
      role: 'box_owner',
    });
  });

  it('check the role of each route', async () => {
    const coach = await userWithRole('coach');
    const member = await userWithRole('member');
    expect((await coach.browser.get('/box/members/count')).status).toBe(200);
    const denied = await member.browser.get('/box/members/count');
    expect(denied.status).toBe(403);
    expect(await denied.json()).toEqual({ error: 'forbidden' });
    expect((await member.browser.get('/box/current')).status).toBe(200);
  });

  it('only see their own box (Row Level Security)', async () => {
    const { browser } = await userWithRole('coach');
    const response = await browser.get('/box/members/count');
    const expected = await membersIn(harness.boxA.boxId);
    expect(expected).toBeGreaterThan(0);
    expect(await response.json()).toEqual({ total: expected });
  });

  it('cannot switch the session to a box the user does not belong to', async () => {
    const { browser } = await userWithRole('box_owner');
    const response = await browser.post('/auth/session/box', { boxId: harness.boxB.boxId });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'not_a_member' });
  });

  it('lose access as soon as the membership is deactivated', async () => {
    const { browser, session } = await userWithRole('coach');
    await harness.database
      .update(boxUsers)
      .set({ isActive: false })
      .where(eq(boxUsers.userId, session.user.id));
    expect((await browser.get('/box/current')).status).toBe(403);
  });

  it('switch between boxes the user belongs to', async () => {
    const owner = await userWithRole('box_owner');
    await harness.database
      .insert(boxUsers)
      .values({ boxId: harness.boxB.boxId, userId: owner.session.user.id, role: 'coach' });
    const switched = await owner.browser.post('/auth/session/box', { boxId: harness.boxB.boxId });
    expect(((await switched.json()) as Session).activeBoxId).toBe(harness.boxB.boxId);
    expect(await (await owner.browser.get('/box/current')).json()).toMatchObject({
      box: { id: harness.boxB.boxId },
      role: 'coach',
    });
  });
});

describe('session view', () => {
  it('never exposes password hashes or tokens', async () => {
    const { browser } = await userWithRole('box_owner');
    const body = await (await browser.get('/auth/session')).text();
    expect(body).not.toMatch(/pbkdf2|tokenHash|passwordHash/);
  });

  it('shows platform admins as such', async () => {
    const { browser, session } = await signedUpBrowser(harness);
    await harness.database
      .update(users)
      .set({ isPlatformAdmin: true })
      .where(eq(users.id, session.user.id));
    const view = (await (await browser.get('/auth/session')).json()) as Session;
    expect(view.user.isPlatformAdmin).toBe(true);
  });
});
