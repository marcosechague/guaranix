import { eq } from 'drizzle-orm';
import { auditLogs, memberPlans, programs } from '@guaranix/db/schema';
import { createPlanSchema } from '@guaranix/shared/schemas';
import { calendarDateIn } from '@guaranix/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expectServiceError } from '../testing/expectations';
import { createServiceFixture, type ServiceFixture } from '../testing/service-fixture';
import { assignMemberPlan } from './member-plans';
import { createPlan, listPlans, updatePlan } from './plans';

let fixture: ServiceFixture;

beforeAll(async () => {
  fixture = await createServiceFixture();
});

afterAll(async () => {
  await fixture.close();
});

const pack = createPlanSchema.parse({
  name: 'Pack 8 clases',
  kind: 'class_pack',
  classCount: 8,
  priceGs: 200_000,
  durationDays: 45,
});

describe('plans', () => {
  it('only lets owners and admins create plans', async () => {
    for (const role of ['coach', 'reception', 'member'] as const) {
      await expectServiceError(
        fixture.as(fixture.boxA, role, (context) => createPlan(context, pack)),
        'forbidden',
      );
    }
    const plan = await fixture.as(fixture.boxA, 'box_admin', (context) =>
      createPlan(context, pack),
    );
    expect(plan).toMatchObject({ priceGs: 200_000, classCount: 8, programIds: [] });
  });

  it('rejects programs of another box', async () => {
    const [foreignProgram] = await fixture.system((transaction) =>
      transaction.select().from(programs).where(eq(programs.boxId, fixture.boxB.boxId)).limit(1),
    );
    await expectServiceError(
      fixture.as(fixture.boxA, 'box_owner', (context) =>
        createPlan(context, { ...pack, programIds: [foreignProgram?.id ?? ''] }),
      ),
      'program_not_found',
    );
  });

  it('hides retired plans from members but not from staff', async () => {
    const retired = await fixture.as(fixture.boxA, 'box_owner', (context) =>
      createPlan(context, { ...pack, name: 'Viejo', isActive: false }),
    );
    const forMember = await fixture.as(fixture.boxA, 'member', (context) => listPlans(context));
    const forStaff = await fixture.as(fixture.boxA, 'reception', (context) => listPlans(context));
    expect(forMember.map((plan) => plan.id)).not.toContain(retired.id);
    expect(forStaff.map((plan) => plan.id)).toContain(retired.id);
    expect(forStaff.every((plan) => plan.boxId === fixture.boxA.boxId)).toBe(true);
  });

  it('changing a price audits it and keeps sold plans at their frozen price', async () => {
    const plan = await fixture.as(fixture.boxA, 'box_owner', (context) =>
      createPlan(context, { ...pack, name: 'Pack precio' }),
    );
    const sold = await fixture.as(fixture.boxA, 'reception', (context) =>
      assignMemberPlan(context, {
        memberId: fixture.boxA.memberId,
        planId: plan.id,
        startsOn: calendarDateIn('America/Asuncion', new Date('2030-01-01T12:00:00Z')),
      }),
    );
    await fixture.as(fixture.boxA, 'box_owner', (context) =>
      updatePlan(context, plan.id, { ...pack, name: 'Pack precio', priceGs: 250_000 }),
    );
    const [stored] = await fixture.system((transaction) =>
      transaction.select().from(memberPlans).where(eq(memberPlans.id, sold.id)),
    );
    expect(stored?.priceGs).toBe(200_000);
    const [entry] = await fixture.system((transaction) =>
      transaction.select().from(auditLogs).where(eq(auditLogs.action, 'plan.price_changed')),
    );
    expect(entry?.changes).toEqual({ priceGs: { from: 200_000, to: 250_000 } });
  });

  it('cannot update a plan of another box', async () => {
    const [foreign] = await fixture.as(fixture.boxB, 'box_owner', (context) => listPlans(context));
    await expectServiceError(
      fixture.as(fixture.boxA, 'box_owner', (context) =>
        updatePlan(context, foreign?.id ?? '', { ...pack, priceGs: 1 }),
      ),
      'plan_not_found',
    );
  });
});
