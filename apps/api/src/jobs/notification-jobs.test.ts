import {
  boxFeatureOverrides,
  charges,
  members,
  notificationDeliveries,
  notifications,
  telegramLinks,
  workouts,
} from '@guaranix/db/schema';
import { addDays } from '@guaranix/shared';
import { eq } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { boxFeatureState } from '../services/feature-access';
import { NOW, TODAY, bookingWorld } from '../testing/booking-helpers';
import {
  createTestNotifications,
  drainNotifications,
  linkTelegram,
  subscribePush,
  type TestNotifications,
} from '../testing/notification-helpers';
import { createServiceFixture, type ServiceFixture } from '../testing/service-fixture';
import { CRONS } from '../scheduled';
import { sendMembershipReminders } from './membership-reminders';
import { sweepNotifications } from './notification-sweeper';
import { announceTomorrowsWorkouts } from './workout-announcements';

let fixture: ServiceFixture;
let world: ReturnType<typeof bookingWorld>;
let notify: TestNotifications;

beforeAll(async () => {
  fixture = await createServiceFixture();
  world = bookingWorld(fixture, fixture.boxA);
});

beforeEach(async () => {
  notify = createTestNotifications();
  // Each test owns the box's charges and WhatsApp settings.
  await fixture.system(async (transaction) => {
    await transaction.delete(notificationDeliveries);
    await transaction.delete(notifications);
    await transaction.update(charges).set({ status: 'void' });
    await transaction.delete(boxFeatureOverrides);
  });
});

afterAll(async () => {
  await fixture.close();
});

const drain = () => drainNotifications(fixture.database, notify, NOW);

async function memberOwing(dueOn: string, options: { phone?: string; push?: boolean } = {}) {
  const { member } = await world.memberWith();
  await fixture.system(async (transaction) => {
    if (options.phone) {
      await transaction
        .update(members)
        .set({ phone: options.phone })
        .where(eq(members.id, member.id));
    }
    await transaction.insert(charges).values({
      boxId: fixture.boxA.boxId,
      memberId: member.id,
      description: 'Cuota de diciembre',
      amountGs: 300_000,
      dueOn,
    });
  });
  if (options.push !== false) await subscribePush(fixture, member.userId ?? '');
  return member;
}

async function allowWhatsApp(monthlyLimit: number | null) {
  await fixture.system((transaction) =>
    transaction.insert(boxFeatureOverrides).values({
      boxId: fixture.boxA.boxId,
      feature: 'whatsapp',
      enabled: true,
      monthlyLimit,
    }),
  );
}

describe('membership reminders', () => {
  it('reminds 3 days before, on the day, and 1 and 7 days late; never in between', async () => {
    const offsets = [3, 2, 0, -1, -3, -7];
    for (const offset of offsets) await memberOwing(addDays(TODAY, offset));
    await sendMembershipReminders(fixture.database, notify.queue, NOW);
    await drain();
    const bodies = notify.channels.push.sent.map((sent) => sent.message);
    expect(bodies.filter((message) => message.title === 'Tu cuota vence pronto')).toHaveLength(2);
    expect(bodies.filter((message) => message.title === 'Tenés una cuota vencida')).toHaveLength(2);
    expect(bodies.map((message) => message.body)).toContain(
      'Cuota de diciembre en Box Demo Asunción: ₲ 300.000, vence hoy.',
    );
  });

  it('sends nothing new when the job runs twice the same day', async () => {
    await memberOwing(TODAY);
    await sendMembershipReminders(fixture.database, notify.queue, NOW);
    await sendMembershipReminders(fixture.database, notify.queue, NOW);
    await drain();
    expect(notify.channels.push.sent).toHaveLength(1);
  });

  it('skips paid charges', async () => {
    await memberOwing(TODAY);
    await fixture.system((transaction) => transaction.update(charges).set({ status: 'paid' }));
    await sendMembershipReminders(fixture.database, notify.queue, NOW);
    await drain();
    expect(notify.channels.push.sent).toHaveLength(0);
  });
});

describe('WhatsApp quota', () => {
  it('sends no WhatsApp when the plan does not include it', async () => {
    await memberOwing(TODAY, { phone: '+595981000001' });
    await sendMembershipReminders(fixture.database, notify.queue, NOW);
    await drain();
    expect(notify.channels.whatsapp.sent).toHaveLength(0);
    expect(notify.channels.push.sent).toHaveLength(1);
  });

  it('sends the approved template up to the monthly limit and records the rest as skipped', async () => {
    await allowWhatsApp(1);
    await memberOwing(TODAY, { phone: '+595981000002', push: false });
    await memberOwing(addDays(TODAY, -1), { phone: '+595981000003', push: false });
    await sendMembershipReminders(fixture.database, notify.queue, NOW);
    await drain();

    expect(notify.channels.whatsapp.sent).toHaveLength(1);
    const [sent] = notify.channels.whatsapp.sent;
    expect(sent?.message.whatsappTemplate?.language).toBe('es');
    expect(sent?.message.whatsappTemplate?.parameters).toEqual(
      expect.arrayContaining(['Member', 'Box Demo Asunción', '₲ 300.000']),
    );
    const rows = await fixture.system((transaction) =>
      transaction
        .select()
        .from(notificationDeliveries)
        .where(eq(notificationDeliveries.channel, 'whatsapp')),
    );
    expect(rows.map((row) => row.status).sort()).toEqual(['sent', 'skipped']);
    expect(rows.find((row) => row.status === 'skipped')?.statusReason).toBe('quota_reached');

    const state = await fixture.system((transaction) =>
      boxFeatureState(transaction, fixture.boxA.boxId, 'whatsapp', NOW),
    );
    expect(state.usedThisMonth).toBe(1);
  });

  it('has no limit when the plan says so', async () => {
    await allowWhatsApp(null);
    await memberOwing(TODAY, { phone: '+595981000004' });
    await memberOwing(TODAY, { phone: '+595981000005' });
    await sendMembershipReminders(fixture.database, notify.queue, NOW);
    await drain();
    expect(notify.channels.whatsapp.sent).toHaveLength(2);
  });
});

describe('overdue summary for managers', () => {
  it('goes by Telegram to linked owners and admins', async () => {
    await memberOwing(addDays(TODAY, -10));
    await memberOwing(addDays(TODAY, -2));
    await linkTelegram(fixture, fixture.boxA.userIds.box_owner, 'owner-chat');
    await linkTelegram(fixture, fixture.boxA.userIds.coach, 'coach-chat');
    await sendMembershipReminders(fixture.database, notify.queue, NOW);
    await drain();
    expect(notify.channels.telegram.sent).toHaveLength(1);
    expect(notify.channels.telegram.sent[0]).toMatchObject({
      address: { chatId: 'owner-chat' },
      message: {
        title: 'Cuotas vencidas en Box Demo Asunción',
        body: '2 alumnos deben ₲ 600.000 en cuotas vencidas.',
        url: 'https://panel.example.com/cobros',
      },
    });
    await fixture.system((transaction) => transaction.delete(telegramLinks));
  });
});

describe("tomorrow's WODs", () => {
  it('announces WODs published days ahead, once', async () => {
    const member = await world.memberWith();
    await subscribePush(fixture, member.member.userId ?? '');
    const programId = await world.programId();
    await fixture.system((transaction) =>
      transaction.insert(workouts).values([
        {
          boxId: fixture.boxA.boxId,
          programId,
          workoutDate: addDays(TODAY, 1),
          title: 'Murph',
          publishedAt: NOW,
        },
        {
          boxId: fixture.boxA.boxId,
          programId,
          workoutDate: addDays(TODAY, 2),
          title: 'Cindy',
          publishedAt: NOW,
        },
      ]),
    );
    await announceTomorrowsWorkouts(fixture.database, notify.queue, NOW);
    await announceTomorrowsWorkouts(fixture.database, notify.queue, NOW);
    await drain();
    const forMember = notify.channels.push.sent.map((sent) => sent.message.body);
    expect(forMember.filter((body) => body.includes('Murph')).length).toBeGreaterThan(0);
    expect(forMember.some((body) => body.includes('Cindy'))).toBe(false);
    expect(new Set(forMember).size).toBe(1);
  });
});

describe('sweeper', () => {
  it('queues events that were recorded but never queued, and stalled deliveries', async () => {
    await memberOwing(TODAY);
    // The job records the events; pretend the queue lost them.
    await sendMembershipReminders(
      fixture.database,
      notify.queue,
      new Date(NOW.getTime() - 5 * 60_000),
    );
    notify.queue.jobs.length = 0;
    await fixture.system((transaction) =>
      transaction
        .update(notifications)
        .set({ createdAt: new Date(NOW.getTime() - 5 * 60_000) })
        .where(eq(notifications.boxId, fixture.boxA.boxId)),
    );
    const swept = await sweepNotifications(fixture.database, notify.queue, NOW);
    expect(swept.expand).toBeGreaterThan(0);
    await drain();
    expect(notify.channels.push.sent).toHaveLength(1);

    // Nothing left: a second sweep finds nothing.
    expect(await sweepNotifications(fixture.database, notify.queue, NOW)).toEqual({
      expand: 0,
      send: 0,
    });
  });

  it('leaves day-old events unsent', async () => {
    await memberOwing(TODAY);
    await sendMembershipReminders(fixture.database, notify.queue, NOW);
    notify.queue.jobs.length = 0;
    await fixture.system((transaction) =>
      transaction
        .update(notifications)
        .set({ createdAt: new Date(NOW.getTime() - 25 * 3600_000) })
        .where(eq(notifications.boxId, fixture.boxA.boxId)),
    );
    expect((await sweepNotifications(fixture.database, notify.queue, NOW)).expand).toBe(0);
  });
});

describe('cron schedule', () => {
  it('matches the triggers in wrangler.jsonc', () => {
    const config = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../wrangler.jsonc'),
      'utf8',
    );
    const crons = /"crons":\s*\[([^\]]*)\]/.exec(config)?.[1] ?? '';
    const declared = [...crons.matchAll(/"([^"]+)"/g)].map((match) => match[1]).sort();
    expect(declared).toEqual(Object.values(CRONS).sort());
  });
});
