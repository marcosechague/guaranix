import { AiProviderError, type AiExtractionRequest } from '@guaranix/ai';
import { withSystemScope } from '@guaranix/db';
import {
  aiUsage,
  boxUsers,
  brodiMessages,
  brodiWeeklySummaries,
  charges,
  members,
  users,
} from '@guaranix/db/schema';
import type { BoxRole, BrodiAnswer, BrodiOverview } from '@guaranix/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHarness, type Harness, signedUpBrowser } from './harness';

let harness: Harness;
let admin: Awaited<ReturnType<typeof signedUpBrowser>>['browser'];
const API_KEY = 'sk-ant-api03-brodi-test-value-1a2b3c4d'; // secret-scan-ignore: fake key for tests
const QUESTION = { question: '¿Quién me debe?' };
const ANSWER = { answer: ' Te deben 5 alumnos. ' };

beforeAll(async () => {
  harness = await createHarness();
  const signed = await signedUpBrowser(harness);
  await harness.database
    .update(users)
    .set({ isPlatformAdmin: true })
    .where(eq(users.id, signed.session.user.id));
  admin = signed.browser;
  await admin.put('/platform/ai/keys/anthropic', { apiKey: API_KEY });
  await admin.patch('/platform/ai', { provider: 'anthropic', model: 'claude-opus-5-5' });
  // Someone only box B has, owing money: box A's snapshot must never mention them.
  await withSystemScope(harness.database, async (transaction) => {
    const [stranger] = await transaction
      .insert(members)
      .values({ boxId: harness.boxB.boxId, firstName: 'Zacarías', lastName: 'Otrobox' })
      .returning();
    await transaction.insert(charges).values({
      boxId: harness.boxB.boxId,
      memberId: stranger?.id ?? '',
      description: 'Cuota',
      amountGs: 999_000,
      dueOn: '2020-01-01',
    });
  });
}, 60_000);

afterAll(async () => {
  await harness.close();
});

beforeEach(async () => {
  harness.ai.failWith = null;
  harness.ai.respond = () => ANSWER;
  await withSystemScope(harness.database, async (transaction) => {
    await transaction.delete(aiUsage);
    await transaction.delete(brodiMessages);
  });
});

async function staff(role: BoxRole, boxId = harness.boxA.boxId) {
  const signed = await signedUpBrowser(harness);
  await harness.database.insert(boxUsers).values({ boxId, userId: signed.session.user.id, role });
  await signed.browser.post('/auth/login', {
    email: signed.email,
    password: signed.password,
    captchaToken: 'ok',
  });
  return signed.browser;
}

const allow = (boxId: string, monthlyLimit: number | null) =>
  admin.put(`/platform/boxes/${boxId}/features/brodi`, { enabled: true, monthlyLimit });

const usageRows = () =>
  withSystemScope(harness.database, (transaction) => transaction.select().from(aiUsage));

const ask = (browser: Awaited<ReturnType<typeof staff>>, body: object = QUESTION) =>
  browser.post('/box/brodi-questions', body);

describe('Brodi for box owners', () => {
  it('is off unless the plan or the platform turns it on', async () => {
    const owner = await staff('box_owner');
    const overview = (await (await owner.get('/box/brodi')).json()) as BrodiOverview;
    expect(overview).toEqual({
      usage: { enabled: false, monthlyLimit: null, usedThisMonth: 0 },
      messages: [],
      latestSummary: null,
    });
    const refused = await ask(owner);
    expect(refused.status).toBe(422);
    expect(await refused.json()).toEqual({ error: 'feature_not_included' });
    expect(await usageRows()).toHaveLength(0);
  });

  it('is only for owners and admins, who see the money', async () => {
    await allow(harness.boxA.boxId, null);
    for (const role of ['coach', 'reception', 'member'] as const) {
      const browser = await staff(role);
      expect((await ask(browser)).status).toBe(403);
      expect((await browser.get('/box/brodi')).status).toBe(403);
    }
    expect(await usageRows()).toHaveLength(0);
  });

  it("answers from the box's own figures without ID numbers, phones or other boxes", async () => {
    await allow(harness.boxA.boxId, 5);
    const owner = await staff('box_admin');
    const requests: AiExtractionRequest[] = [];
    harness.ai.respond = (request) => {
      requests.push(request);
      return ANSWER;
    };

    const response = await ask(owner);
    expect(response.status).toBe(200);
    const body = (await response.json()) as BrodiAnswer;
    expect(body.question).toMatchObject({ role: 'user', content: '¿Quién me debe?' });
    expect(body.answer).toMatchObject({ role: 'assistant', content: 'Te deben 5 alumnos.' });
    expect(body.usage).toEqual({ enabled: true, monthlyLimit: 5, usedThisMonth: 1 });

    const sent = JSON.stringify(requests[0]?.parts);
    expect(sent).toContain('Lucía Giménez');
    expect(sent).toContain('₲');
    expect(sent).toContain('¿Quién me debe?');
    expect(sent).not.toContain('4123456');
    expect(sent).not.toContain('+595');
    expect(sent).not.toContain('@box-a.local');
    expect(sent).not.toContain('Zacarías');
    expect(sent).not.toContain('999.000');
    expect(sent).not.toContain(harness.boxA.boxId);
    expect(requests[0]?.instructions).not.toContain('Rodrigo');

    const [usage] = await usageRows();
    expect(usage).toMatchObject({ boxId: harness.boxA.boxId, feature: 'brodi' });
    expect(usage?.inputTokens).toBeGreaterThan(0);
  });

  it('keeps each person their own conversation and sends the last turns along', async () => {
    await allow(harness.boxA.boxId, null);
    const owner = await staff('box_owner');
    const partner = await staff('box_admin');
    await ask(owner);
    const requests: AiExtractionRequest[] = [];
    harness.ai.respond = (request) => {
      requests.push(request);
      return { answer: 'El mes pasado, menos.' };
    };
    await ask(owner, { question: '¿Y el mes pasado?' });
    expect(JSON.stringify(requests[0]?.parts)).toContain('Te deben 5 alumnos.');

    const mine = (await (await owner.get('/box/brodi')).json()) as BrodiOverview;
    expect(mine.messages.map((message) => message.content)).toEqual([
      '¿Quién me debe?',
      'Te deben 5 alumnos.',
      '¿Y el mes pasado?',
      'El mes pasado, menos.',
    ]);
    const theirs = (await (await partner.get('/box/brodi')).json()) as BrodiOverview;
    expect(theirs.messages).toEqual([]);
  });

  it('counts a failed answer, saves nothing of it and stops at the monthly limit', async () => {
    await allow(harness.boxA.boxId, 1);
    const owner = await staff('box_owner');
    harness.ai.failWith = new AiProviderError('unavailable', 529);
    expect(await (await ask(owner)).json()).toEqual({ error: 'ai_unavailable' });
    harness.ai.failWith = null;
    expect(await (await ask(owner)).json()).toEqual({ error: 'feature_limit_reached' });
    expect(await usageRows()).toHaveLength(1);
    const overview = (await (await owner.get('/box/brodi')).json()) as BrodiOverview;
    expect(overview.messages).toEqual([]);
  });

  it('lets only one of several parallel questions through the last use', async () => {
    await allow(harness.boxA.boxId, 1);
    const owner = await staff('box_owner');
    const responses = await Promise.all(Array.from({ length: 4 }, () => ask(owner)));
    expect(responses.map((response) => response.status).sort()).toEqual([200, 422, 422, 422]);
    expect(await usageRows()).toHaveLength(1);
  });

  it('shares no quota with AI import', async () => {
    await allow(harness.boxA.boxId, 1);
    await admin.put(`/platform/boxes/${harness.boxA.boxId}/features/ai_import`, {
      enabled: true,
      monthlyLimit: 1,
    });
    const owner = await staff('box_owner');
    harness.ai.respond = () => ({ members: [], plans: [] });
    await owner.post('/box/ai-imports/extract', { kind: 'sheet', fileName: 'a.csv', text: 'x' });
    harness.ai.respond = () => ANSWER;
    expect((await ask(owner)).status).toBe(200);
  });

  it('limits how often one person can ask', async () => {
    await allow(harness.boxA.boxId, null);
    const owner = await staff('box_owner');
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) statuses.push((await ask(owner)).status);
    expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('gives box staff a plain message when the platform key is the problem', async () => {
    await allow(harness.boxA.boxId, null);
    const owner = await staff('box_owner');
    harness.ai.failWith = new AiProviderError('auth', 401);
    expect(await (await ask(owner)).json()).toEqual({ error: 'brodi_unavailable' });
  });

  it('rejects an empty or oversized question before spending a use', async () => {
    await allow(harness.boxA.boxId, null);
    const owner = await staff('box_owner');
    expect((await ask(owner, { question: ' ' })).status).toBe(400);
    expect((await ask(owner, { question: 'x'.repeat(501) })).status).toBe(400);
    expect(await usageRows()).toHaveLength(0);
  });

  it('is read-only while a platform admin is "entering as" the box', async () => {
    await allow(harness.boxA.boxId, null);
    const entered = await admin.post(`/platform/boxes/${harness.boxA.boxId}/impersonate`, {
      reason: 'Soporte: revisar Brodi',
    });
    expect(entered.status).toBe(200);
    const response = await ask(admin);
    expect(response.status).toBe(403);
    expect(await usageRows()).toHaveLength(0);
    await admin.post('/platform/impersonation/end', {});
  });

  it("shows only the box's own latest weekly summary", async () => {
    await withSystemScope(harness.database, (transaction) =>
      transaction.insert(brodiWeeklySummaries).values([
        {
          boxId: harness.boxB.boxId,
          weekStart: '2026-11-23',
          source: 'template',
          summary: 'Semana de B.',
          figures: {},
        },
        {
          boxId: harness.boxA.boxId,
          weekStart: '2026-11-16',
          source: 'ai',
          summary: 'Semana de A.',
          figures: {},
        },
      ]),
    );
    const owner = await staff('box_owner');
    const overview = (await (await owner.get('/box/brodi')).json()) as BrodiOverview;
    expect(overview.latestSummary).toMatchObject({
      weekStart: '2026-11-16',
      summary: 'Semana de A.',
    });
  });
});
