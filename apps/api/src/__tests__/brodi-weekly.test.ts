import { AiProviderError, type AiExtractionRequest } from '@guaranix/ai';
import { withSystemScope } from '@guaranix/db';
import { aiUsage, brodiWeeklySummaries, notifications, users } from '@guaranix/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sendBrodiWeeklySummaries } from '../jobs/brodi-weekly-summaries';
import { previousWeekStart } from '../services/brodi/weekly-summary';
import { templateSummary } from '../services/brodi/weekly-figures';
import { createHarness, type Harness, signedUpBrowser, testEnv } from './harness';

let harness: Harness;
let admin: Awaited<ReturnType<typeof signedUpBrowser>>['browser'];
const API_KEY = 'sk-ant-api03-weekly-test-value-5e6f7a8b'; // secret-scan-ignore: fake key for tests
/** 09:00 in Asunción on a Monday, when the reminders cron runs. */
const MONDAY = new Date('2026-11-30T12:00:00Z');
const TUESDAY = new Date('2026-12-01T12:00:00Z');

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
  harness.ai.respond = () => ({ summary: 'Buena semana, cobraste bien.' });
  await withSystemScope(harness.database, async (transaction) => {
    await transaction.delete(aiUsage);
    await transaction.delete(brodiWeeklySummaries);
    // Nothing expands them in these tests, so they have no deliveries yet.
    await transaction.delete(notifications).where(eq(notifications.kind, 'staff_weekly_summary'));
  });
});

const allow = (boxId: string, monthlyLimit: number | null, enabled = true) =>
  admin.put(`/platform/boxes/${boxId}/features/brodi`, { enabled, monthlyLimit });

const run = (now: Date) =>
  sendBrodiWeeklySummaries(
    harness.database,
    harness.notificationQueue,
    { secretsKey: testEnv.AI_SECRETS_KEY, factory: harness.services.aiProviderFactory },
    now,
  );

const summaries = () =>
  withSystemScope(harness.database, (transaction) =>
    transaction.select().from(brodiWeeklySummaries),
  );

const summaryNotifications = () =>
  withSystemScope(harness.database, (transaction) =>
    transaction.select().from(notifications).where(eq(notifications.kind, 'staff_weekly_summary')),
  );

describe('Brodi weekly summary', () => {
  it('covers the Monday-to-Sunday week before', () => {
    expect(previousWeekStart('2026-11-30')).toBe('2026-11-23');
    expect(previousWeekStart('2026-12-06')).toBe('2026-11-23');
  });

  it('runs on Mondays only, for boxes with Brodi, once per week', async () => {
    await allow(harness.boxA.boxId, null);
    await allow(harness.boxB.boxId, null, false);
    expect((await run(TUESDAY)).boxes).toBe(0);
    expect(await summaries()).toHaveLength(0);

    const result = await run(MONDAY);
    expect(result.failedBoxIds).toEqual([]);
    expect(result.notifications).toBe(1);
    const [written] = await summaries();
    expect(written).toMatchObject({
      boxId: harness.boxA.boxId,
      weekStart: '2026-11-23',
      source: 'ai',
      summary: 'Buena semana, cobraste bien.',
    });
    const [notice] = await summaryNotifications();
    expect(notice).toMatchObject({
      boxId: harness.boxA.boxId,
      audience: { type: 'staff', roles: ['box_owner', 'box_admin'] },
      params: { summary: 'Buena semana, cobraste bien.' },
    });
    const [usage] = await withSystemScope(harness.database, (transaction) =>
      transaction.select().from(aiUsage),
    );
    expect(usage).toMatchObject({ feature: 'brodi', userId: harness.boxA.ownerId });

    expect((await run(MONDAY)).notifications).toBe(0);
    expect(await summaries()).toHaveLength(1);
  });

  it('sends the AI only figures and the snapshot, never ID numbers or phones', async () => {
    await allow(harness.boxA.boxId, null);
    const requests: AiExtractionRequest[] = [];
    harness.ai.respond = (request) => {
      requests.push(request);
      return { summary: 'Semana movida.' };
    };
    await run(MONDAY);
    const sent = JSON.stringify(requests[0]?.parts);
    expect(sent).toContain('collectedGs');
    expect(sent).not.toContain('4123456');
    expect(sent).not.toContain('+595');
  });

  it('falls back to fixed text without using AI when the month is used up', async () => {
    await allow(harness.boxA.boxId, 0);
    const result = await run(MONDAY);
    expect(result.notifications).toBe(1);
    const [written] = await summaries();
    expect(written?.source).toBe('template');
    expect(written?.summary).toContain('La semana pasada cobraste ₲');
    expect(await withSystemScope(harness.database, (t) => t.select().from(aiUsage))).toEqual([]);
  });

  it('falls back to fixed text when the provider fails, and still counts the use', async () => {
    await allow(harness.boxA.boxId, 5);
    harness.ai.failWith = new AiProviderError('unavailable', 529);
    await run(MONDAY);
    const [written] = await summaries();
    expect(written?.source).toBe('template');
    expect(await withSystemScope(harness.database, (t) => t.select().from(aiUsage))).toHaveLength(
      1,
    );
  });

  it('writes fixed text that reads well with or without classes and debt', () => {
    const figures = {
      collectedGs: 1_250_000,
      overdueGs: 0,
      debtors: 0,
      activeMembers: 40,
      newMembers: 3,
      lostMembers: 1,
      classes: 0,
      attended: 0,
      occupancyRate: null,
      absentMembers: 0,
    };
    expect(templateSummary(figures)).toBe(
      'La semana pasada cobraste ₲ 1.250.000. No hubo clases. Tenés 40 alumnos activos: 3 nuevos y 1 que dejaron. Nadie tiene cuotas vencidas.',
    );
    expect(
      templateSummary({
        ...figures,
        classes: 30,
        occupancyRate: 0.62,
        debtors: 2,
        overdueGs: 700_000,
        absentMembers: 5,
      }),
    ).toBe(
      'La semana pasada cobraste ₲ 1.250.000. Diste 30 clases con 62% de ocupación. Tenés 40 alumnos activos: 3 nuevos y 1 que dejaron. 5 alumnos activos no vinieron en toda la semana. Te deben ₲ 700.000 en cuotas vencidas entre 2 alumnos.',
    );
  });
});
