import { AiProviderError, type AiExtractionRequest } from '@guaranix/ai';
import { withSystemScope } from '@guaranix/db';
import { aiUsage, boxUsers, members, users } from '@guaranix/db/schema';
import {
  type AiImportProposal,
  type AiImportStatus,
  type BoxRole,
  MEMBER_IMPORT_FIELDS,
} from '@guaranix/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHarness, type Harness, signedUpBrowser } from './harness';

let harness: Harness;
let admin: Awaited<ReturnType<typeof signedUpBrowser>>['browser'];
const API_KEY = 'sk-ant-api03-import-test-value-9f8e7d6c'; // secret-scan-ignore: fake key for tests

const SHEET = {
  kind: 'sheet',
  fileName: 'Socios Juan Pérez.xlsx',
  text: 'Nombre\tDebe\nAna Gómez\t150.000',
};
const ANSWER = {
  members: [
    {
      firstName: null,
      lastName: null,
      fullName: ' Ana Gómez ',
      documentNumber: null,
      email: null,
      phone: null,
      birthDate: null,
      joinedOn: null,
      status: null,
      externalRef: null,
      notes: null,
      planName: null,
      planStartsOn: null,
      planEndsOn: null,
      classesRemaining: null,
      balanceGs: '150.000',
      balanceDueOn: null,
    },
    // A blank line the model echoed back: dropped.
    Object.fromEntries(
      MEMBER_IMPORT_FIELDS.map((field) => [field, field === 'notes' ? ' ' : null]),
    ),
  ],
  plans: [],
};

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
}, 60_000);

afterAll(async () => {
  await harness.close();
});

beforeEach(async () => {
  harness.ai.failWith = null;
  harness.ai.respond = () => ANSWER;
  await withSystemScope(harness.database, (transaction) => transaction.delete(aiUsage));
});

async function staff(role: BoxRole, boxId = harness.boxA.boxId) {
  const signed = await signedUpBrowser(harness);
  await harness.database.insert(boxUsers).values({ boxId, userId: signed.session.user.id, role });
  // Log in again so the session picks up the new box.
  await signed.browser.post('/auth/login', {
    email: signed.email,
    password: signed.password,
    captchaToken: 'ok',
  });
  return signed.browser;
}

const allow = (boxId: string, monthlyLimit: number | null) =>
  admin.put(`/platform/boxes/${boxId}/features/ai_import`, { enabled: true, monthlyLimit });

const usageRows = () =>
  withSystemScope(harness.database, (transaction) => transaction.select().from(aiUsage));

describe('AI import', () => {
  it('is off unless the plan or the platform turns it on', async () => {
    const owner = await staff('box_owner');
    const status = await owner.get('/box/imports/ai-status');
    expect(await status.json()).toEqual({
      status: { enabled: false, monthlyLimit: null, usedThisMonth: 0 } satisfies AiImportStatus,
    });
    const refused = await owner.post('/box/ai-imports/extract', SHEET);
    expect(refused.status).toBe(422);
    expect(await refused.json()).toEqual({ error: 'feature_not_included' });
    expect(await usageRows()).toHaveLength(0);
  });

  it('is only for owners and admins', async () => {
    await allow(harness.boxA.boxId, null);
    for (const role of ['coach', 'reception', 'member'] as const) {
      const browser = await staff(role);
      expect((await browser.post('/box/ai-imports/extract', SHEET)).status).toBe(403);
      expect((await browser.get('/box/imports/ai-status')).status).toBe(403);
    }
  });

  it('proposes trimmed rows, saves nothing but the use, and sends only the file', async () => {
    await allow(harness.boxA.boxId, 5);
    const owner = await staff('box_admin');
    const membersBefore = await withSystemScope(harness.database, (transaction) =>
      transaction.select({ id: members.id }).from(members),
    );
    const requests: AiExtractionRequest[] = [];
    harness.ai.respond = (request) => {
      requests.push(request);
      return ANSWER;
    };

    const response = await owner.post('/box/ai-imports/extract', SHEET);
    expect(response.status).toBe(200);
    expect((await response.json()) as AiImportProposal).toEqual({
      members: [{ fullName: 'Ana Gómez', balanceGs: '150.000' }],
      plans: [],
    });

    const sent = JSON.stringify(requests);
    expect(sent).toContain('Ana Gómez');
    expect(sent).not.toContain('Juan Pérez');
    expect(sent).not.toContain(harness.boxA.boxId);
    expect(sent).not.toContain('box-a');

    const membersAfter = await withSystemScope(harness.database, (transaction) =>
      transaction.select({ id: members.id }).from(members),
    );
    expect(membersAfter).toHaveLength(membersBefore.length);
    const [usage] = await usageRows();
    expect(usage).toMatchObject({
      boxId: harness.boxA.boxId,
      feature: 'ai_import',
      model: 'claude-opus-5-5',
    });
    expect(usage?.inputTokens).toBeGreaterThan(0);

    const status = await owner.get('/box/imports/ai-status');
    expect(await status.json()).toEqual({
      status: { enabled: true, monthlyLimit: 5, usedThisMonth: 1 },
    });
  });

  it('counts a failed read and stops at the monthly limit', async () => {
    await allow(harness.boxA.boxId, 1);
    const owner = await staff('box_owner');
    harness.ai.failWith = new AiProviderError('unavailable', 529);
    const failed = await owner.post('/box/ai-imports/extract', SHEET);
    expect(await failed.json()).toEqual({ error: 'ai_unavailable' });

    harness.ai.failWith = null;
    const limited = await owner.post('/box/ai-imports/extract', SHEET);
    expect(await limited.json()).toEqual({ error: 'feature_limit_reached' });
    expect(await usageRows()).toHaveLength(1);
  });

  it('lets only one of several parallel reads through the last use', async () => {
    await allow(harness.boxA.boxId, 1);
    const owner = await staff('box_owner');
    const responses = await Promise.all(
      Array.from({ length: 4 }, () => owner.post('/box/ai-imports/extract', SHEET)),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([200, 422, 422, 422]);
    expect(await usageRows()).toHaveLength(1);
  });

  it('limits how often one person can ask for a read', async () => {
    await allow(harness.boxA.boxId, null);
    const owner = await staff('box_owner');
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      statuses.push((await owner.post('/box/ai-imports/extract', SHEET)).status);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it("does not spend another box's uses", async () => {
    await allow(harness.boxA.boxId, 1);
    await allow(harness.boxB.boxId, 1);
    const ownerA = await staff('box_owner');
    const ownerB = await staff('box_owner', harness.boxB.boxId);
    expect((await ownerA.post('/box/ai-imports/extract', SHEET)).status).toBe(200);
    expect((await ownerB.post('/box/ai-imports/extract', SHEET)).status).toBe(200);
    const rows = await usageRows();
    expect(rows.map((row) => row.boxId).sort()).toEqual(
      [harness.boxA.boxId, harness.boxB.boxId].sort(),
    );
    const statusB = await ownerB.get('/box/imports/ai-status');
    expect(((await statusB.json()) as { status: AiImportStatus }).status.usedThisMonth).toBe(1);
  });

  it('gives box staff a plain message when the platform key is the problem', async () => {
    await allow(harness.boxA.boxId, null);
    const owner = await staff('box_owner');
    harness.ai.failWith = new AiProviderError('auth', 401);
    const response = await owner.post('/box/ai-imports/extract', SHEET);
    expect(await response.json()).toEqual({ error: 'ai_import_unavailable' });
  });

  it('rejects an answer that does not match the rows', async () => {
    await allow(harness.boxA.boxId, null);
    const owner = await staff('box_owner');
    harness.ai.respond = () => ({ people: [] });
    const response = await owner.post('/box/ai-imports/extract', SHEET);
    expect(await response.json()).toEqual({ error: 'ai_invalid_answer' });
  });

  it('validates the file', async () => {
    await allow(harness.boxA.boxId, null);
    const owner = await staff('box_owner');
    const bad = { kind: 'image', fileName: 'foto.jpg', mediaType: 'image/gif', data: 'aGVsbG8=' };
    expect((await owner.post('/box/ai-imports/extract', bad)).status).toBe(400);
    expect(await usageRows()).toHaveLength(0);
  });
});
