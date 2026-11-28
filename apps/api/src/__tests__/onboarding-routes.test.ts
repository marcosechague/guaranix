import { withSystemScope } from '@guaranix/db';
import { auditLogs, boxes, classes, classSchedules, plans } from '@guaranix/db/schema';
import { BOX_TEMPLATES, type BoxSignupInput, type Session } from '@guaranix/shared';
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

const signup = (changes: Partial<BoxSignupInput> = {}): BoxSignupInput => ({
  name: 'Lambaré Funcional',
  city: 'Lambaré',
  phone: '+595981123456',
  businessType: 'functional_box',
  setup: structuredClone(BOX_TEMPLATES.functional_box),
  ...changes,
});

const totalIn = async (
  table: typeof classSchedules | typeof plans | typeof classes,
  boxId: string,
) => {
  const [row] = await withSystemScope(harness.database, (transaction) =>
    transaction.select({ total: count() }).from(table).where(eq(table.boxId, boxId)),
  );
  return row?.total ?? 0;
};

describe('box sign-up', () => {
  it('needs a session', async () => {
    const { browser } = await signedUpBrowser(harness);
    await browser.post('/auth/logout');
    expect((await browser.post('/onboarding/box', signup())).status).toBe(401);
  });

  it('creates the box in trial with the reviewed setup and makes the caller its owner', async () => {
    const { browser } = await signedUpBrowser(harness);
    const response = await browser.post('/onboarding/box', signup());
    expect(response.status).toBe(201);
    const result = (await response.json()) as {
      box: { id: string; slug: string };
      platformPlan: { code: string };
    };
    expect(result.box.slug).toBe('lambare-funcional');
    expect(result.platformPlan.code).toBe('founders');

    const [box] = await withSystemScope(harness.database, (transaction) =>
      transaction.select().from(boxes).where(eq(boxes.id, result.box.id)),
    );
    expect(box).toMatchObject({ status: 'trial', bookingOpensHoursBefore: 24, city: 'Lambaré' });
    // 6 weekday times × 5 days + 2 Saturday + 2 Open Box × 5 days.
    expect(await totalIn(classSchedules, result.box.id)).toBe(42);
    expect(await totalIn(plans, result.box.id)).toBe(6);
    // Two weeks of classes so members can book right away: each weekday twice.
    expect(await totalIn(classes, result.box.id)).toBe(84);

    const session = (await (await browser.get('/auth/session')).json()) as Session;
    expect(session.activeBoxId).toBe(result.box.id);
    expect(session.memberships).toEqual([
      expect.objectContaining({ boxId: result.box.id, role: 'box_owner' }),
    ]);
    const current = await browser.get('/box/current');
    expect(await current.json()).toMatchObject({ role: 'box_owner' });
    const [audit] = await withSystemScope(harness.database, (transaction) =>
      transaction.select().from(auditLogs).where(eq(auditLogs.boxId, result.box.id)),
    );
    expect(audit?.action).toBe('box.signed_up');
  });

  it('only creates classes for the new box', async () => {
    const allClasses = async () => {
      const [row] = await withSystemScope(harness.database, (transaction) =>
        transaction.select({ total: count() }).from(classes),
      );
      return row?.total ?? 0;
    };
    const before = await allClasses();
    const { browser } = await signedUpBrowser(harness);
    const response = await browser.post(
      '/onboarding/box',
      signup({ name: 'Otro Box', slug: 'otro-box' }),
    );
    expect(response.status).toBe(201);
    expect((await allClasses()) - before).toBe(84);
  });

  it('rejects impossible timetables with the issues to show', async () => {
    const { browser } = await signedUpBrowser(harness);
    const setup = structuredClone(BOX_TEMPLATES.functional_box);
    setup.slots.push({
      programKey: 'crossfit',
      startTime: '23:30',
      weekdays: [1],
      durationMinutes: 60,
      capacity: 16,
    });
    const response = await browser.post('/onboarding/box', signup({ setup }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: 'setup_invalid',
      issues: [{ severity: 'error', code: 'slot_ends_after_midnight', path: 'slots.10' }],
    });
    expect((await (await browser.get('/auth/session')).json()) as Session).toMatchObject({
      memberships: [],
    });
  });

  it('asks to confirm odd prices, then saves them', async () => {
    const { browser } = await signedUpBrowser(harness);
    const setup = structuredClone(BOX_TEMPLATES.functional_box);
    const [unlimited, ...rest] = setup.plans;
    if (!unlimited) throw new Error('Template has no plans');
    setup.plans = [{ ...unlimited, priceGs: 35_000 }, ...rest];
    const first = await browser.post('/onboarding/box', signup({ name: 'Box Precio', setup }));
    expect(first.status).toBe(422);
    expect(await first.json()).toMatchObject({
      error: 'setup_needs_confirmation',
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'plan_price_low', path: 'plans.0' }),
      ]),
    });
    const confirmed = await browser.post(
      '/onboarding/box',
      signup({ name: 'Box Precio', setup, acceptWarnings: true, bookingOpensHoursBefore: 48 }),
    );
    expect(confirmed.status).toBe(201);
    const { box } = (await confirmed.json()) as { box: { id: string } };
    const [row] = await withSystemScope(harness.database, (transaction) =>
      transaction.select().from(boxes).where(eq(boxes.id, box.id)),
    );
    expect(row?.bookingOpensHoursBefore).toBe(48);
  });

  it('uses the base plan once the founders places are taken', async () => {
    const { browser } = await signedUpBrowser(harness);
    await withSystemScope(harness.database, (transaction) =>
      transaction
        .update(boxes)
        .set({ platformPlanId: harness.platform.foundersPlanId })
        .where(eq(boxes.id, harness.boxA.boxId)),
    );
    const { platformPlans } = await import('@guaranix/db/schema');
    await harness.database
      .update(platformPlans)
      .set({ boxLimit: 1 })
      .where(eq(platformPlans.id, harness.platform.foundersPlanId));
    const response = await browser.post('/onboarding/box', signup({ name: 'Box Tardío' }));
    expect(((await response.json()) as { platformPlan: { code: string } }).platformPlan.code).toBe(
      'base',
    );
  });

  it('limits how many boxes one person creates per day', async () => {
    const { browser } = await signedUpBrowser(harness);
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const empty = { ...BOX_TEMPLATES.pilates_studio };
      statuses.push(
        (
          await browser.post(
            '/onboarding/box',
            signup({ name: `Estudio ${attempt}`, businessType: 'pilates_studio', setup: empty }),
          )
        ).status,
      );
    }
    expect(statuses).toEqual([201, 201, 201, 429]);
  });
});
