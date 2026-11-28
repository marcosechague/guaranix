import { aiUsage, boxFeatureOverrides, platformPlanFeatures } from '@guaranix/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { expectServiceError } from '../testing/expectations';
import { createServiceFixture, type ServiceFixture } from '../testing/service-fixture';
import {
  assertFeatureAvailable,
  boxFeatureState,
  monthStart,
  recordAiUsage,
} from './feature-access';

let fixture: ServiceFixture;
let basePlanId: string;
const usage = {
  feature: 'ai_import',
  provider: 'anthropic',
  model: 'claude-opus-5-5',
  inputTokens: 1000,
  outputTokens: 200,
} as const;

beforeAll(async () => {
  fixture = await createServiceFixture();
  const [box] = await fixture.system((transaction) =>
    transaction.query.boxes.findMany({
      where: (table, { eq: equals }) => equals(table.id, fixture.boxA.boxId),
    }),
  );
  if (!box?.platformPlanId) throw new Error('Box A should be on the base plan');
  basePlanId = box.platformPlanId;
});

afterAll(async () => {
  await fixture.close();
});

beforeEach(async () => {
  await fixture.system(async (transaction) => {
    await transaction.delete(aiUsage);
    await transaction.delete(boxFeatureOverrides);
    await transaction.delete(platformPlanFeatures);
  });
});

const enablePlan = (monthlyLimit: number | null) =>
  fixture.system((transaction) =>
    transaction
      .insert(platformPlanFeatures)
      .values({ platformPlanId: basePlanId, feature: 'ai_import', enabled: true, monthlyLimit }),
  );

describe('feature access', () => {
  it('is off when the plan does not include it', async () => {
    await expectServiceError(
      fixture.as(fixture.boxA, 'box_owner', (context) =>
        assertFeatureAvailable(context, 'ai_import'),
      ),
      'feature_not_included',
    );
  });

  it('counts uses this month against the plan limit', async () => {
    await enablePlan(2);
    for (let use = 0; use < 2; use += 1) {
      await fixture.as(fixture.boxA, 'box_owner', async (context) => {
        await assertFeatureAvailable(context, 'ai_import');
        await recordAiUsage(context, usage);
      });
    }
    await expectServiceError(
      fixture.as(fixture.boxA, 'box_owner', (context) =>
        assertFeatureAvailable(context, 'ai_import'),
      ),
      'feature_limit_reached',
    );
  });

  it("does not count another box's uses", async () => {
    await enablePlan(1);
    await fixture.as(fixture.boxB, 'box_owner', (context) => recordAiUsage(context, usage));
    const state = await fixture.as(fixture.boxA, 'box_owner', (context) =>
      assertFeatureAvailable(context, 'ai_import'),
    );
    expect(state.usedThisMonth).toBe(0);
  });

  it('starts counting again on the first of the month, box time', async () => {
    await enablePlan(1);
    const lastMonth = new Date('2026-10-31T23:00:00-03:00');
    await fixture.as(
      fixture.boxA,
      'box_owner',
      (context) => recordAiUsage(context, usage),
      lastMonth,
    );
    // Half an hour into November in Asunción: October's use no longer counts.
    const firstOfMonth = new Date('2026-11-01T00:30:00-03:00');
    const state = await fixture.as(
      fixture.boxA,
      'box_owner',
      (context) => assertFeatureAvailable(context, 'ai_import'),
      firstOfMonth,
    );
    expect(state.usedThisMonth).toBe(0);
    expect(monthStart('America/Asuncion', firstOfMonth).toISOString()).toBe(
      '2026-11-01T03:00:00.000Z',
    );
  });

  it('a platform override wins over the plan, both ways', async () => {
    await enablePlan(1);
    await fixture.system((transaction) =>
      transaction.insert(boxFeatureOverrides).values({
        boxId: fixture.boxA.boxId,
        feature: 'ai_import',
        enabled: null,
        monthlyLimit: 5,
      }),
    );
    await fixture.as(fixture.boxA, 'box_owner', (context) => recordAiUsage(context, usage));
    const raised = await fixture.as(fixture.boxA, 'box_owner', (context) =>
      assertFeatureAvailable(context, 'ai_import'),
    );
    expect(raised.effective).toEqual({ enabled: true, monthlyLimit: 5 });

    await fixture.system((transaction) =>
      transaction
        .update(boxFeatureOverrides)
        .set({ enabled: false })
        .where(eq(boxFeatureOverrides.boxId, fixture.boxA.boxId)),
    );
    await expectServiceError(
      fixture.as(fixture.boxA, 'box_owner', (context) =>
        assertFeatureAvailable(context, 'ai_import'),
      ),
      'feature_not_included',
    );
    // Box B, on the same plan, is untouched by box A's override.
    const other = await fixture.as(fixture.boxB, 'box_owner', (context) =>
      boxFeatureState(context.transaction, fixture.boxB.boxId, 'ai_import', context.now),
    );
    expect(other.effective).toEqual({ enabled: true, monthlyLimit: 1 });
  });

  it('records usage for the acting user and box, and a box cannot erase it', async () => {
    await fixture.as(fixture.boxA, 'box_admin', (context) => recordAiUsage(context, usage));
    const rows = await fixture.system((transaction) =>
      transaction.select().from(aiUsage).where(eq(aiUsage.boxId, fixture.boxA.boxId)),
    );
    expect(rows).toMatchObject([{ userId: fixture.boxA.userIds.box_admin, inputTokens: 1000 }]);
    const erase = fixture.as(fixture.boxA, 'box_owner', (context) =>
      context.transaction.delete(aiUsage),
    );
    await expect(erase).rejects.toThrow();
  });
});
