import { AiProviderError } from '@guaranix/ai';
import { withSystemScope } from '@guaranix/db';
import { aiProviderKeys, auditLogs, boxes, boxUsers, users } from '@guaranix/db/schema';
import type { AiConfiguration, BoxFeatureState, PlanFeatureState } from '@guaranix/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness, signedUpBrowser } from './harness';

let harness: Harness;
const API_KEY = 'sk-ant-api03-test-secret-value-a1b2c3d4'; // secret-scan-ignore: fake key for tests

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
  return signed.browser;
}

async function boxOwner() {
  const signed = await signedUpBrowser(harness);
  await harness.database
    .insert(boxUsers)
    .values({ boxId: harness.boxA.boxId, userId: signed.session.user.id, role: 'box_owner' });
  return signed.browser;
}

const systemRows = <T>(work: Parameters<typeof withSystemScope<T>>[1]) =>
  withSystemScope(harness.database, work);

describe('platform AI routes', () => {
  it('are closed to box staff', async () => {
    const owner = await boxOwner();
    const planPath = `/platform/plans/${harness.platform.basePlanId}/features/ai_import`;
    expect((await owner.get('/platform/ai')).status).toBe(403);
    expect((await owner.put('/platform/ai/keys/anthropic', { apiKey: API_KEY })).status).toBe(403);
    expect((await owner.put(planPath, { enabled: true })).status).toBe(403);
  });

  it('stores the key encrypted, shows only its last four characters and audits without it', async () => {
    const admin = await platformAdmin();
    const saved = await admin.put('/platform/ai/keys/anthropic', { apiKey: ` ${API_KEY} ` });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ key: { provider: 'anthropic', hint: 'c3d4' } });

    const listed = await admin.get('/platform/ai');
    const body = await listed.text();
    expect(body).not.toContain('test-secret-value');
    const configuration = JSON.parse(body) as AiConfiguration;
    expect(configuration.secretsKeyConfigured).toBe(true);
    expect(configuration.keys.find((key) => key.provider === 'anthropic')?.hint).toBe('c3d4');
    expect(configuration.keys.find((key) => key.provider === 'openai')?.hint).toBeNull();

    const stored = await systemRows((transaction) => transaction.select().from(aiProviderKeys));
    expect(JSON.stringify(stored)).not.toContain('test-secret-value');
    const audits = await systemRows((transaction) =>
      transaction.select().from(auditLogs).where(eq(auditLogs.action, 'ai_provider_key.set')),
    );
    expect(audits).toHaveLength(1);
    expect(JSON.stringify(audits)).not.toContain('test-secret-value');
  });

  it('tests the configured provider with the decrypted key', async () => {
    const admin = await platformAdmin();
    await admin.put('/platform/ai/keys/anthropic', { apiKey: API_KEY });
    expect(
      (await admin.patch('/platform/ai', { provider: 'anthropic', model: 'claude-opus-5-5' }))
        .status,
    ).toBe(200);

    const tested = await admin.post('/platform/ai/test');
    expect(await tested.json()).toEqual({
      ok: true,
      provider: 'anthropic',
      model: 'claude-opus-5-5',
    });
    expect(harness.ai.configs.at(-1)).toEqual({
      provider: 'anthropic',
      model: 'claude-opus-5-5',
      apiKey: API_KEY,
    });

    harness.ai.failWith = new AiProviderError('auth', 401);
    const rejected = await admin.post('/platform/ai/test');
    harness.ai.failWith = null;
    expect(rejected.status).toBe(422);
    expect(await rejected.json()).toEqual({ error: 'ai_key_rejected' });
  });

  it('reports a provider with no key as not configured', async () => {
    const admin = await platformAdmin();
    await admin.patch('/platform/ai', { provider: 'gemini', model: 'gemini-test' });
    const tested = await admin.post('/platform/ai/test');
    expect(await tested.json()).toEqual({ error: 'ai_not_configured' });
    await admin.patch('/platform/ai', { provider: 'anthropic', model: 'claude-opus-5-5' });
  });

  it('removes a key', async () => {
    const admin = await platformAdmin();
    await admin.put('/platform/ai/keys/openai', { apiKey: 'sk-proj-another-test-key-0000' }); // secret-scan-ignore: fake key for tests
    expect((await admin.delete('/platform/ai/keys/openai')).status).toBe(200);
    expect((await admin.delete('/platform/ai/keys/openai')).status).toBe(404);
  });

  it('rejects unknown providers and malformed keys', async () => {
    const admin = await platformAdmin();
    expect((await admin.put('/platform/ai/keys/llama', { apiKey: API_KEY })).status).toBe(404);
    expect((await admin.put('/platform/ai/keys/openai', { apiKey: 'short' })).status).toBe(400);
  });
});

describe('features per plan and per box', () => {
  const boxPath = () => `/platform/boxes/${harness.boxA.boxId}/features`;

  it('a box follows its plan until the platform overrides it', async () => {
    const admin = await platformAdmin();
    await harness.database
      .update(boxes)
      .set({ platformPlanId: harness.platform.basePlanId })
      .where(eq(boxes.id, harness.boxA.boxId));

    const planPath = `/platform/plans/${harness.platform.basePlanId}/features`;
    const set = await admin.put(`${planPath}/ai_import`, { enabled: true, monthlyLimit: 10 });
    expect(await set.json()).toEqual({
      feature: { feature: 'ai_import', enabled: true, monthlyLimit: 10 },
    });
    const planFeatures = (await (await admin.get(planPath)).json()) as {
      features: PlanFeatureState[];
    };
    expect(planFeatures.features).toEqual([
      { feature: 'ai_import', enabled: true, monthlyLimit: 10 },
      { feature: 'whatsapp', enabled: false, monthlyLimit: null },
      { feature: 'card_payments', enabled: false, monthlyLimit: null },
      { feature: 'brodi', enabled: false, monthlyLimit: null },
    ]);

    const listed = (await (await admin.get(boxPath())).json()) as { features: BoxFeatureState[] };
    expect(listed.features[0]).toMatchObject({
      override: null,
      effective: { enabled: true, monthlyLimit: 10 },
      usedThisMonth: 0,
    });

    const off = await admin.put(`${boxPath()}/ai_import`, { enabled: false, monthlyLimit: null });
    expect(((await off.json()) as { feature: BoxFeatureState }).feature.effective).toEqual({
      enabled: false,
      monthlyLimit: 10,
    });

    const cleared = await admin.put(`${boxPath()}/ai_import`, {
      enabled: null,
      monthlyLimit: null,
    });
    expect(((await cleared.json()) as { feature: BoxFeatureState }).feature).toMatchObject({
      override: null,
      effective: { enabled: true, monthlyLimit: 10 },
    });

    // The box's own history shows what the platform decided.
    const audits = await systemRows((transaction) =>
      transaction
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.boxId, harness.boxA.boxId),
            eq(auditLogs.action, 'box.feature_overridden'),
          ),
        ),
    );
    expect(audits).toHaveLength(2);
  });

  it('rejects unknown features and negative limits', async () => {
    const admin = await platformAdmin();
    expect(
      (await admin.put(`${boxPath()}/teleport`, { enabled: true, monthlyLimit: null })).status,
    ).toBe(404);
    const planPath = `/platform/plans/${harness.platform.basePlanId}/features/ai_import`;
    expect((await admin.put(planPath, { enabled: true, monthlyLimit: -1 })).status).toBe(400);
  });
});
