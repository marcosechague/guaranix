import { eq } from 'drizzle-orm';
import { charges, members, plans } from '@guaranix/db/schema';
import { addDays, calendarDateIn } from '@guaranix/shared';
import { createPlanSchema } from '@guaranix/shared/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expectServiceError } from '../testing/expectations';
import { createServiceFixture, type ServiceFixture } from '../testing/service-fixture';
import {
  assignMemberPlan,
  cancelMemberPlan,
  listMemberPlans,
  pauseMemberPlan,
  removePause,
} from './member-plans';
import { createMember } from './members';
import { createPlan } from './plans';

let fixture: ServiceFixture;
let packId: string;
let unlimitedId: string;
const today = calendarDateIn('America/Asuncion', new Date());

beforeAll(async () => {
  fixture = await createServiceFixture();
  const [pack, unlimited] = await fixture.as(fixture.boxA, 'box_owner', (context) =>
    Promise.all([
      createPlan(
        context,
        createPlanSchema.parse({
          name: 'Pack 10',
          kind: 'class_pack',
          classCount: 10,
          priceGs: 300_000,
          durationDays: 60,
        }),
      ),
      createPlan(
        context,
        createPlanSchema.parse({
          name: 'Ilimitado 30',
          kind: 'unlimited',
          priceGs: 350_000,
          durationDays: 30,
        }),
      ),
    ]),
  );
  packId = pack.id;
  unlimitedId = unlimited.id;
});

afterAll(async () => {
  await fixture.close();
});

async function newMember(firstName: string) {
  return fixture.as(fixture.boxA, 'reception', (context) =>
    createMember(context, { firstName, lastName: 'Plan' }),
  );
}

describe('selling a plan', () => {
  it('freezes price and credits, computes the end date and opens a charge', async () => {
    const member = await newMember('Credits');
    const sold = await fixture.as(fixture.boxA, 'reception', (context) =>
      assignMemberPlan(context, { memberId: member.id, planId: packId, startsOn: today }),
    );
    expect(sold).toMatchObject({
      priceGs: 300_000,
      classesRemaining: 10,
      classesPerWeek: null,
      startsOn: today,
      endsOn: addDays(today, 59),
      status: 'active',
    });
    const owed = await fixture.system((transaction) =>
      transaction.select().from(charges).where(eq(charges.memberPlanId, sold.id)),
    );
    expect(owed).toEqual([
      expect.objectContaining({
        amountGs: 300_000,
        dueOn: today,
        status: 'open',
        description: 'Pack 10',
      }),
    ]);
  });

  it('applies a discounted price to the sale and the charge', async () => {
    const member = await newMember('Discount');
    const sold = await fixture.as(fixture.boxA, 'box_admin', (context) =>
      assignMemberPlan(context, {
        memberId: member.id,
        planId: unlimitedId,
        startsOn: today,
        priceGs: 315_000,
      }),
    );
    const [charge] = await fixture.system((transaction) =>
      transaction.select().from(charges).where(eq(charges.memberPlanId, sold.id)),
    );
    expect(sold.priceGs).toBe(315_000);
    expect(charge?.amountGs).toBe(315_000);
  });

  it('opens no charge for a free plan', async () => {
    const member = await newMember('Free');
    const sold = await fixture.as(fixture.boxA, 'reception', (context) =>
      assignMemberPlan(context, {
        memberId: member.id,
        planId: packId,
        startsOn: today,
        priceGs: 0,
      }),
    );
    const owed = await fixture.system((transaction) =>
      transaction.select().from(charges).where(eq(charges.memberPlanId, sold.id)),
    );
    expect(owed).toEqual([]);
  });

  it('refuses overlapping plans but allows a renewal right after', async () => {
    const member = await newMember('Overlap');
    const sell = (startsOn: string) =>
      fixture.as(fixture.boxA, 'reception', (context) =>
        assignMemberPlan(context, { memberId: member.id, planId: unlimitedId, startsOn }),
      );
    await sell(today);
    await expectServiceError(sell(addDays(today, 29)), 'member_plan_overlap');
    const renewal = await sell(addDays(today, 30));
    expect(renewal.startsOn).toBe(addDays(today, 30));
  });

  it('refuses inactive members and retired plans', async () => {
    const member = await newMember('Inactive');
    await fixture.system((transaction) =>
      transaction.update(members).set({ status: 'inactive' }).where(eq(members.id, member.id)),
    );
    await expectServiceError(
      fixture.as(fixture.boxA, 'reception', (context) =>
        assignMemberPlan(context, { memberId: member.id, planId: packId, startsOn: today }),
      ),
      'member_inactive',
    );
    const active = await newMember('Retired');
    await fixture.system((transaction) =>
      transaction.update(plans).set({ isActive: false }).where(eq(plans.name, 'Ilimitado 30')),
    );
    await expectServiceError(
      fixture.as(fixture.boxA, 'reception', (context) =>
        assignMemberPlan(context, { memberId: active.id, planId: unlimitedId, startsOn: today }),
      ),
      'plan_inactive',
    );
    await fixture.system((transaction) =>
      transaction.update(plans).set({ isActive: true }).where(eq(plans.name, 'Ilimitado 30')),
    );
  });

  it('is only for front desk roles', async () => {
    for (const role of ['coach', 'member'] as const) {
      await expectServiceError(
        fixture.as(fixture.boxA, role, (context) =>
          assignMemberPlan(context, {
            memberId: fixture.boxA.memberId,
            planId: packId,
            startsOn: today,
          }),
        ),
        'forbidden',
      );
    }
  });

  it("cannot sell another box's plan or to another box's member", async () => {
    await expectServiceError(
      fixture.as(fixture.boxB, 'box_owner', (context) =>
        assignMemberPlan(context, {
          memberId: fixture.boxB.memberId,
          planId: packId,
          startsOn: today,
        }),
      ),
      'plan_not_found',
    );
    await expectServiceError(
      fixture.as(fixture.boxA, 'box_owner', (context) =>
        assignMemberPlan(context, {
          memberId: fixture.boxB.memberId,
          planId: packId,
          startsOn: today,
        }),
      ),
      'member_not_found',
    );
  });
});

describe('pauses', () => {
  async function soldUnlimited(name: string) {
    const member = await newMember(name);
    const sold = await fixture.as(fixture.boxA, 'reception', (context) =>
      assignMemberPlan(context, { memberId: member.id, planId: unlimitedId, startsOn: today }),
    );
    return { member, sold };
  }

  it('extends the plan by the paused days and shows it as paused', async () => {
    const { member, sold } = await soldUnlimited('Pause');
    const { memberPlan } = await fixture.as(fixture.boxA, 'reception', (context) =>
      pauseMemberPlan(context, sold.id, {
        startsOn: today,
        endsOn: addDays(today, 6),
        reason: 'Viaje',
      }),
    );
    expect(memberPlan.endsOn).toBe(addDays(sold.endsOn, 7));
    const [view] = await fixture.as(fixture.boxA, 'reception', (context) =>
      listMemberPlans(context, member.id),
    );
    expect(view?.state).toBe('paused');
    expect(view?.pauses).toHaveLength(1);
  });

  it('shows the price to the front desk but not to a coach', async () => {
    const { member } = await soldUnlimited('Price');
    const listAs = (role: 'reception' | 'coach') =>
      fixture.as(fixture.boxA, role, (context) => listMemberPlans(context, member.id));
    expect((await listAs('reception'))[0]?.priceGs).toBe(350_000);
    const [coachView] = await listAs('coach');
    expect(coachView).toMatchObject({ state: 'active', priceGs: null });
  });

  it('refuses overlapping pauses and pauses outside the plan', async () => {
    const { sold } = await soldUnlimited('PauseRules');
    const pause = (startsOn: string, endsOn: string) =>
      fixture.as(fixture.boxA, 'reception', (context) =>
        pauseMemberPlan(context, sold.id, { startsOn, endsOn, reason: null }),
      );
    await pause(addDays(today, 5), addDays(today, 10));
    await expectServiceError(pause(addDays(today, 10), addDays(today, 12)), 'pause_overlap');
    await expectServiceError(pause(addDays(today, -1), addDays(today, 2)), 'pause_outside_plan');
    await expectServiceError(pause(addDays(today, 3), addDays(today, 2)), 'pause_dates_invalid');
  });

  it('removing a future pause gives the days back; a started one cannot be removed', async () => {
    const { sold } = await soldUnlimited('Unpause');
    const future = await fixture.as(fixture.boxA, 'reception', (context) =>
      pauseMemberPlan(context, sold.id, {
        startsOn: addDays(today, 3),
        endsOn: addDays(today, 4),
        reason: null,
      }),
    );
    const restored = await fixture.as(fixture.boxA, 'reception', (context) =>
      removePause(context, future.pause.id),
    );
    expect(restored.endsOn).toBe(sold.endsOn);

    const started = await fixture.as(fixture.boxA, 'reception', (context) =>
      pauseMemberPlan(context, sold.id, { startsOn: today, endsOn: today, reason: null }),
    );
    await expectServiceError(
      fixture.as(fixture.boxA, 'reception', (context) => removePause(context, started.pause.id)),
      'pause_already_started',
    );
  });

  it('cannot pause a cancelled plan', async () => {
    const { sold } = await soldUnlimited('Cancelled');
    await fixture.as(fixture.boxA, 'reception', (context) => cancelMemberPlan(context, sold.id));
    await expectServiceError(
      fixture.as(fixture.boxA, 'reception', (context) =>
        pauseMemberPlan(context, sold.id, { startsOn: today, endsOn: today, reason: null }),
      ),
      'member_plan_not_active',
    );
  });

  it("cannot pause another box's member plan", async () => {
    const { sold } = await soldUnlimited('Foreign');
    await expectServiceError(
      fixture.as(fixture.boxB, 'box_owner', (context) =>
        pauseMemberPlan(context, sold.id, { startsOn: today, endsOn: today, reason: null }),
      ),
      'member_plan_not_found',
    );
  });
});

describe('member view', () => {
  it("lets a member read their own plans but not someone else's", async () => {
    const own = await fixture.as(fixture.boxA, 'member', (context) =>
      listMemberPlans(context, fixture.boxA.memberId),
    );
    expect(own.every((plan) => plan.memberId === fixture.boxA.memberId)).toBe(true);
    const other = await newMember('Private');
    await expectServiceError(
      fixture.as(fixture.boxA, 'member', (context) => listMemberPlans(context, other.id)),
      'member_not_found',
    );
  });
});
