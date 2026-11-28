import { withSystemScope } from '@guaranix/db';
import { auditLogs, boxUsers, boxes, programs, sessions, users } from '@guaranix/db/schema';
import type { PlatformBoxSummary, PlatformMetrics, Session } from '@guaranix/shared';
import { and, count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness, signedUpBrowser, uniqueEmail } from './harness';

let harness: Harness;
const SUPPORT = { reason: 'No le aparecen las clases del sábado' };

beforeAll(async () => {
  harness = await createHarness();
});

afterAll(async () => {
  await harness.close();
});

async function platformAdmin() {
  const signed = await signedUpBrowser(harness);
  await harness.database
    .update(users)
    .set({ isPlatformAdmin: true })
    .where(eq(users.id, signed.session.user.id));
  return signed;
}

/** Logs in as box A's seeded owner (they have no password, so one is set through signup data). */
async function ownerOf(boxId: string) {
  const signed = await signedUpBrowser(harness);
  await harness.database
    .insert(boxUsers)
    .values({ boxId, userId: signed.session.user.id, role: 'box_owner' });
  await signed.browser.post('/auth/login', {
    email: signed.email,
    password: signed.password,
    captchaToken: 'ok',
  });
  return signed;
}

const system = <T>(work: Parameters<typeof withSystemScope<T>>[1]) =>
  withSystemScope(harness.database, work);

async function auditActions(boxId: string) {
  const rows = await system((transaction) =>
    transaction.select().from(auditLogs).where(eq(auditLogs.boxId, boxId)),
  );
  return rows;
}

describe('platform routes', () => {
  it('are only for platform admins', async () => {
    const owner = await ownerOf(harness.boxA.boxId);
    expect((await owner.browser.get('/platform/metrics')).status).toBe(403);
    expect(
      (await owner.browser.post(`/platform/boxes/${harness.boxA.boxId}/impersonate`, SUPPORT))
        .status,
    ).toBe(403);
    const { browser } = await signedUpBrowser(harness);
    expect((await browser.get('/platform/boxes')).status).toBe(403);
  });

  it('create a box in trial with its owner and the Paraguayan template', async () => {
    const { browser } = await platformAdmin();
    const ownerEmail = uniqueEmail('owner');
    const response = await browser.post('/platform/boxes', {
      name: 'Ñu Guasú Training',
      city: 'San Lorenzo',
      platformPlanId: harness.platform.foundersPlanId,
      ownerEmail,
      ownerName: 'Carla Duarte',
    });
    expect(response.status).toBe(201);
    const { box } = (await response.json()) as { box: PlatformBoxSummary };
    expect(box).toMatchObject({
      slug: 'nu-guasu-training',
      status: 'trial',
      monthlyFeeGs: 169_000,
      owner: { fullName: 'Carla Duarte', email: ownerEmail },
    });
    const trialDays = (Date.parse(box.trialEndsAt ?? '') - Date.now()) / 86_400_000;
    expect(Math.round(trialDays)).toBe(30);
    const [created] = await system((transaction) =>
      transaction.select({ total: count() }).from(programs).where(eq(programs.boxId, box.id)),
    );
    expect(created?.total).toBe(2);
    expect((await auditActions(box.id)).map((entry) => entry.action)).toContain('box.created');

    const again = await browser.post('/platform/boxes', {
      name: 'Ñu Guasú Training',
      platformPlanId: harness.platform.basePlanId,
      ownerEmail,
      ownerName: 'Carla Duarte',
      applyTemplate: false,
    });
    expect(((await again.json()) as { box: PlatformBoxSummary }).box.slug).toBe(
      'nu-guasu-training-2',
    );
  });

  it('respect the founders plan limit', async () => {
    const { browser } = await platformAdmin();
    const plans = (await (await browser.get('/platform/plans')).json()) as {
      plans: { id: string; boxCount: number }[];
    };
    const founders = plans.plans.find((plan) => plan.id === harness.platform.foundersPlanId);
    const used = founders?.boxCount ?? 0;
    expect(used).toBeGreaterThan(0);

    const tooLow = await browser.patch(`/platform/plans/${harness.platform.foundersPlanId}`, {
      boxLimit: used - 1 || 1,
    });
    if (used > 1) expect(tooLow.status).toBe(422);
    await browser.patch(`/platform/plans/${harness.platform.foundersPlanId}`, { boxLimit: used });
    const full = await browser.post('/platform/boxes', {
      name: 'Box Lleno',
      platformPlanId: harness.platform.foundersPlanId,
      ownerEmail: uniqueEmail(),
      ownerName: 'Pedro',
    });
    expect(full.status).toBe(422);
    expect(await full.json()).toEqual({ error: 'platform_plan_full' });
    await browser.patch(`/platform/plans/${harness.platform.foundersPlanId}`, { boxLimit: 20 });
  });

  it('suspend and reactivate a box, blocking its staff meanwhile', async () => {
    const { browser } = await platformAdmin();
    const owner = await ownerOf(harness.boxA.boxId);
    const path = `/platform/boxes/${harness.boxA.boxId}`;

    expect((await browser.post(`${path}/suspend`, {})).status).toBe(400);
    const suspended = await browser.post(`${path}/suspend`, { reason: 'Cuota de GuaraniX impaga' });
    expect(((await suspended.json()) as { box: PlatformBoxSummary }).box.status).toBe('suspended');
    const blocked = await owner.browser.get('/box/current');
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toEqual({ error: 'box_suspended' });
    const session = (await (await owner.browser.get('/auth/session')).json()) as Session;
    expect(session.memberships[0]?.boxStatus).toBe('suspended');

    expect((await browser.post(`${path}/suspend`, { reason: 'Otra vez' })).status).toBe(422);
    const reactivated = await browser.post(`${path}/reactivate`);
    expect(((await reactivated.json()) as { box: PlatformBoxSummary }).box.status).toBe('active');
    expect((await owner.browser.get('/box/current')).status).toBe(200);

    const actions = (await auditActions(harness.boxA.boxId)).map((entry) => entry.action);
    expect(actions).toEqual(expect.arrayContaining(['box.suspended', 'box.reactivated']));
  });

  it('count MRR from active boxes only, with extra locations', async () => {
    const { browser } = await platformAdmin();
    const before = (
      (await (await browser.get('/platform/metrics')).json()) as {
        metrics: PlatformMetrics;
      }
    ).metrics;
    await system((transaction) =>
      transaction
        .update(boxes)
        .set({ status: 'active', platformPlanId: harness.platform.basePlanId })
        .where(eq(boxes.id, harness.boxB.boxId)),
    );
    await browser.patch(`/platform/boxes/${harness.boxB.boxId}`, { extraLocations: 1 });
    const after = (
      (await (await browser.get('/platform/metrics')).json()) as {
        metrics: PlatformMetrics;
      }
    ).metrics;
    expect(after.mrrGs - before.mrrGs).toBe(199_000 + 99_000);
    expect(after.boxes.withExtraLocations).toBeGreaterThanOrEqual(1);
    expect(after.activeMembers).toBeGreaterThan(0);
  });

  it('let an admin enter as a box, audited, until they leave', async () => {
    const admin = await platformAdmin();
    const boxId = harness.boxB.boxId;
    expect((await admin.browser.get('/box/current')).status).toBe(403);

    expect((await admin.browser.post(`/platform/boxes/${boxId}/impersonate`)).status).toBe(400);
    expect((await admin.browser.post(`/platform/boxes/${boxId}/impersonate`, SUPPORT)).status).toBe(
      200,
    );
    const current = await admin.browser.get('/box/current');
    expect(await current.json()).toMatchObject({ box: { id: boxId }, role: 'box_owner' });
    const session = (await (await admin.browser.get('/auth/session')).json()) as Session;
    expect(session).toMatchObject({ activeBoxId: boxId, impersonation: { boxId } });

    expect((await admin.browser.post('/box/programs', { name: 'Halterofilia' })).status).toBe(201);
    const [write] = await system((transaction) =>
      transaction
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.boxId, boxId), eq(auditLogs.action, 'program.created'))),
    );
    expect(write?.impersonatorUserId).toBe(admin.session.user.id);

    expect((await admin.browser.post('/platform/impersonation/end')).status).toBe(200);
    expect((await admin.browser.get('/box/current')).status).toBe(403);
    const actions = (await auditActions(boxId)).map((entry) => entry.action);
    expect(actions).toEqual(
      expect.arrayContaining(['box.impersonation_started', 'box.impersonation_ended']),
    );
  });

  it('ignore an impersonation that expired or belongs to a non-admin', async () => {
    const admin = await platformAdmin();
    const boxId = harness.boxB.boxId;
    await admin.browser.post(`/platform/boxes/${boxId}/impersonate`, SUPPORT);
    await system((transaction) =>
      transaction
        .update(sessions)
        .set({ impersonationEndsAt: new Date(Date.now() - 1000) })
        .where(eq(sessions.userId, admin.session.user.id)),
    );
    expect((await admin.browser.get('/box/current')).status).toBe(403);

    await admin.browser.post(`/platform/boxes/${boxId}/impersonate`, SUPPORT);
    await harness.database
      .update(users)
      .set({ isPlatformAdmin: false })
      .where(eq(users.id, admin.session.user.id));
    expect((await admin.browser.get('/box/current')).status).toBe(403);
    // It was dropped when it stopped being valid, so getting the flag back does not revive it.
    await harness.database
      .update(users)
      .set({ isPlatformAdmin: true })
      .where(eq(users.id, admin.session.user.id));
    expect((await admin.browser.get('/box/current')).status).toBe(403);
  });

  it('stop an impersonation when the box is removed', async () => {
    const admin = await platformAdmin();
    const created = await admin.browser.post('/platform/boxes', {
      name: 'Box Para Baja',
      platformPlanId: harness.platform.basePlanId,
      ownerEmail: uniqueEmail(),
      ownerName: 'Rosa',
      applyTemplate: false,
    });
    const { box } = (await created.json()) as { box: PlatformBoxSummary };
    await admin.browser.post(`/platform/boxes/${box.id}/impersonate`, SUPPORT);
    expect((await admin.browser.get('/box/current')).status).toBe(200);
    await admin.browser.post(`/platform/boxes/${box.id}/remove`, { reason: 'Cerró el local' });
    const denied = await admin.browser.get('/box/current');
    expect(await denied.json()).toEqual({ error: 'box_cancelled' });
    expect(
      (await admin.browser.post(`/platform/boxes/${box.id}/impersonate`, SUPPORT)).status,
    ).toBe(422);
    expect((await admin.browser.patch(`/platform/boxes/${box.id}`, {})).status).toBe(400);
  });

  it('manage GuaraniX plans as data', async () => {
    const { browser } = await platformAdmin();
    const created = await browser.post('/platform/plans', {
      code: 'annual_base',
      name: 'Base anual',
      monthlyPriceGs: 165_833,
      extraLocationMonthlyPriceGs: 99_000,
    });
    expect(created.status).toBe(201);
    const duplicate = await browser.post('/platform/plans', {
      code: 'annual_base',
      name: 'Otro',
      monthlyPriceGs: 1,
      extraLocationMonthlyPriceGs: 1,
    });
    expect(duplicate.status).toBe(409);
    const { plan } = (await created.json()) as { plan: { id: string } };
    const updated = await browser.patch(`/platform/plans/${plan.id}`, { monthlyPriceGs: 170_000 });
    expect(
      ((await updated.json()) as { plan: { monthlyPriceGs: number } }).plan.monthlyPriceGs,
    ).toBe(170_000);
  });
});
