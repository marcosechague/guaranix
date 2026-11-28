import {
  boxes,
  classes,
  notificationDeliveries,
  notificationPreferences,
  notifications,
  pushSubscriptions,
  workouts,
} from '@guaranix/db/schema';
import { ChannelError } from '@guaranix/messaging';
import { addDays } from '@guaranix/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NOW, TODAY, bookingWorld, hoursFromNow } from '../../testing/booking-helpers';
import {
  createTestNotifications,
  drainNotifications,
  fakeQueueMessage,
  linkTelegram,
  subscribePush,
  type TestNotifications,
  withOutbox,
} from '../../testing/notification-helpers';
import { createServiceFixture, type ServiceFixture } from '../../testing/service-fixture';
import { bookClass, cancelBooking } from '../bookings';
import { cancelClass } from '../classes';
import type { ServiceContext } from '../context';
import { setWorkoutPublished } from '../workouts';
import { handleNotificationJob } from './consumer';
import { MAX_DELIVERY_ATTEMPTS } from './deliver';

let fixture: ServiceFixture;
let world: ReturnType<typeof bookingWorld>;
let notify: TestNotifications;

beforeAll(async () => {
  fixture = await createServiceFixture();
  world = bookingWorld(fixture, fixture.boxA);
  await world.setPolicy({ bookingOpensHoursBefore: 168, waitlistAutoPromote: true });
});

beforeEach(() => {
  notify = createTestNotifications();
});

afterAll(async () => {
  await fixture.close();
});

const asOwner = <T>(work: (context: ServiceContext) => Promise<T>) =>
  withOutbox(notify, (run) => world.as('box_owner', run), work);

const drain = (now = NOW) => drainNotifications(fixture.database, notify, now);

async function bookedMember(classId: string, options: { push?: boolean } = {}) {
  const plan = await world.createPlanOf({ kind: 'unlimited' });
  const member = await world.memberWith(plan);
  const userId = member.member.userId ?? '';
  if (options.push !== false) await subscribePush(fixture, userId);
  const booking = await member.act((context) => bookClass(context, { classId }));
  return { ...member, userId, booking };
}

async function deliveriesOf(kind: string) {
  return fixture.system((transaction) =>
    transaction
      .select({ delivery: notificationDeliveries, kind: notifications.kind })
      .from(notificationDeliveries)
      .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
      .where(eq(notifications.kind, kind as never)),
  );
}

describe('class cancelled', () => {
  it('tells each booked member by push and the coach by Telegram, once', async () => {
    const classRow = await world.createClass({ startsAt: hoursFromNow(24) });
    await fixture.system((transaction) =>
      transaction
        .update(classes)
        .set({ coachUserId: fixture.boxA.userIds.coach })
        .where(eq(classes.id, classRow.id)),
    );
    const withPush = await bookedMember(classRow.id);
    await bookedMember(classRow.id, { push: false });
    await linkTelegram(fixture, fixture.boxA.userIds.coach, 'coach-chat');

    await asOwner((context) => cancelClass(context, classRow.id, 'Feriado'));
    expect(notify.queue.jobs.map((job) => job.type)).toEqual(['expand', 'expand']);
    await drain();

    expect(notify.channels.push.sent).toHaveLength(1);
    expect(notify.channels.push.sent[0]?.address.endpoint).toMatch(/^https:\/\/push\.example\.com/);
    expect(notify.channels.push.sent[0]?.message).toMatchObject({
      title: 'Clase cancelada',
      url: '/reservar',
      tag: `class-${classRow.id}`,
    });
    expect(notify.channels.push.sent[0]?.message.body).toContain('(Feriado)');
    expect(notify.channels.telegram.sent).toEqual([
      expect.objectContaining({ address: { channel: 'telegram', chatId: 'coach-chat' } }),
    ]);
    expect(notify.channels.telegram.sent[0]?.message.url).toBe('https://panel.example.com/clases');

    const [delivery] = (await deliveriesOf('class_cancelled')).filter(
      (row) => row.delivery.userId === withPush.userId,
    );
    expect(delivery?.delivery).toMatchObject({ status: 'sent', attempts: 1, channel: 'push' });

    // A second cancel, or the same queue message delivered twice, sends nothing new.
    await asOwner((context) => cancelClass(context, classRow.id, 'Feriado'));
    notify.queue.jobs.push({ type: 'send', deliveryId: delivery?.delivery.id ?? '' });
    await drain();
    expect(notify.channels.push.sent).toHaveLength(1);
  });

  it('respects a member who turned booking notices off', async () => {
    const classRow = await world.createClass({ startsAt: hoursFromNow(26) });
    const member = await bookedMember(classRow.id);
    await fixture.system((transaction) =>
      transaction
        .insert(notificationPreferences)
        .values({ userId: member.userId, topic: 'bookings', channel: 'push', enabled: false }),
    );
    await asOwner((context) => cancelClass(context, classRow.id, null));
    await drain();
    expect(notify.channels.push.sent).toHaveLength(0);
  });
});

describe('waitlist and staff bookings', () => {
  it('tells the member who got the freed spot', async () => {
    const classRow = await world.createClass({ startsAt: hoursFromNow(30), capacity: 1 });
    const first = await bookedMember(classRow.id);
    const waiting = await bookedMember(classRow.id);
    expect(waiting.booking.status).toBe('waitlisted');

    await withOutbox(
      notify,
      (run) => first.act(run),
      (context) => cancelBooking(context, first.booking.id),
    );
    await drain();
    expect(notify.channels.push.sent).toHaveLength(1);
    expect(notify.channels.push.sent[0]?.message.title).toBe('Tenés lugar en la clase');
  });

  it('confirms a booking made by reception, not one the member made', async () => {
    const classRow = await world.createClass({ startsAt: hoursFromNow(32) });
    const own = await bookedMember(classRow.id);
    expect(notify.queue.jobs).toHaveLength(0);
    await withOutbox(
      notify,
      (run) => own.act(run),
      (context) =>
        bookClass(context, { classId: (classRow as { id: string }).id }).catch(() => null),
    );
    expect(notify.queue.jobs).toHaveLength(0);

    const plan = await world.createPlanOf({ kind: 'unlimited' });
    const other = await world.memberWith(plan);
    await subscribePush(fixture, other.member.userId ?? '');
    await withOutbox(
      notify,
      (run) => world.as('reception', run),
      (context) => bookClass(context, { classId: classRow.id, memberId: other.member.id }),
    );
    await drain();
    expect(notify.channels.push.sent.map((sent) => sent.message.title)).toEqual([
      'Reserva confirmada',
    ]);
  });
});

describe('workout published', () => {
  async function draftWorkout(date: string) {
    const [workout] = await fixture.system((transaction) =>
      transaction
        .insert(workouts)
        .values({
          boxId: fixture.boxA.boxId,
          programId: classProgram,
          workoutDate: date,
          title: 'Fran',
        })
        .returning(),
    );
    return workout?.id ?? '';
  }
  let classProgram: string;

  beforeAll(async () => {
    classProgram = await world.programId();
  });

  it("announces today's WOD to active members of this box only, once", async () => {
    const member = await world.memberWith();
    await subscribePush(fixture, member.member.userId ?? '');
    await subscribePush(fixture, fixture.boxB.userIds.member);
    const workoutId = await draftWorkout(TODAY);
    const publish = (published: boolean) =>
      withOutbox(
        notify,
        (run) => world.as('coach', run),
        (context) => setWorkoutPublished(context, workoutId, published),
      );

    await publish(true);
    await drain();
    const titles = notify.channels.push.sent.map((sent) => sent.message.body);
    expect(titles).toContain('CrossFit: Fran');
    expect(notify.channels.push.sent.every((sent) => sent.message.url === '/wod')).toBe(true);
    const reached = (await deliveriesOf('workout_published')).map((row) => row.delivery.boxId);
    expect(new Set(reached)).toEqual(new Set([fixture.boxA.boxId]));

    const sentBefore = notify.channels.push.sent.length;
    await publish(false);
    await publish(true);
    await drain();
    expect(notify.channels.push.sent).toHaveLength(sentBefore);
  });

  it('stays quiet for a WOD loaded for next week', async () => {
    const workoutId = await draftWorkout(addDays(TODAY, 7));
    await withOutbox(
      notify,
      (run) => world.as('coach', run),
      (context) => setWorkoutPublished(context, workoutId, true),
    );
    expect(notify.queue.jobs).toHaveLength(0);
  });
});

describe('delivery', () => {
  async function oneDelivery() {
    const classRow = await world.createClass({ startsAt: hoursFromNow(40) });
    const member = await bookedMember(classRow.id);
    await asOwner((context) => cancelClass(context, classRow.id, null));
    const [expand] = notify.queue.jobs.splice(0);
    if (!expand) throw new Error('nothing queued');
    await handleNotificationJob(fixture.database, notify, fakeQueueMessage(expand), NOW);
    const [send] = notify.queue.jobs.splice(0);
    if (!send || send.type !== 'send') throw new Error('no delivery queued');
    return { member, deliveryId: send.deliveryId, send };
  }

  async function deliveryRow(id: string) {
    const [row] = await fixture.system((transaction) =>
      transaction.select().from(notificationDeliveries).where(eq(notificationDeliveries.id, id)),
    );
    return row;
  }

  it('retries a provider outage with backoff, then sends', async () => {
    const { deliveryId, send } = await oneDelivery();
    notify.channels.push.failNext(new ChannelError('retryable', 'push_503'));
    const first = fakeQueueMessage(send);
    await handleNotificationJob(fixture.database, notify, first, NOW);
    expect(first.retryDelay).toBe(30);
    expect(await deliveryRow(deliveryId)).toMatchObject({
      status: 'queued',
      attempts: 1,
      statusReason: 'push_503',
    });

    await handleNotificationJob(fixture.database, notify, fakeQueueMessage(send, 2), NOW);
    expect(await deliveryRow(deliveryId)).toMatchObject({ status: 'sent', attempts: 2 });
    expect(notify.channels.push.sent).toHaveLength(1);
  });

  it(`gives up after ${MAX_DELIVERY_ATTEMPTS} attempts`, async () => {
    const { deliveryId, send } = await oneDelivery();
    for (let attempt = 1; attempt <= MAX_DELIVERY_ATTEMPTS; attempt += 1) {
      notify.channels.push.failNext(new ChannelError('retryable', 'push_503'));
      const message = fakeQueueMessage(send, attempt);
      await handleNotificationJob(fixture.database, notify, message, NOW);
      expect(message.retryDelay !== null).toBe(attempt < MAX_DELIVERY_ATTEMPTS);
    }
    expect(await deliveryRow(deliveryId)).toMatchObject({
      status: 'failed',
      statusReason: 'push_503',
    });
  });

  it('forgets a push subscription the browser dropped', async () => {
    const { deliveryId, send, member } = await oneDelivery();
    notify.channels.push.failNext(new ChannelError('address_gone', 'push_410'));
    await handleNotificationJob(fixture.database, notify, fakeQueueMessage(send), NOW);
    expect(await deliveryRow(deliveryId)).toMatchObject({
      status: 'failed',
      statusReason: 'push_410',
    });
    const left = await fixture.system((transaction) =>
      transaction
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, member.userId)),
    );
    expect(left).toHaveLength(0);
  });

  it('skips a delivery whose channel is not configured', async () => {
    const { deliveryId, send } = await oneDelivery();
    await handleNotificationJob(
      fixture.database,
      { ...notify, channels: { ...notify.channels, push: null } },
      fakeQueueMessage(send),
      NOW,
    );
    expect(await deliveryRow(deliveryId)).toMatchObject({
      status: 'skipped',
      statusReason: 'channel_unavailable',
    });
  });

  it('takes back a push left mid-send by a crashed worker', async () => {
    const { deliveryId, send } = await oneDelivery();
    await fixture.system((transaction) =>
      transaction
        .update(notificationDeliveries)
        .set({ status: 'sending', updatedAt: new Date(NOW.getTime() - 11 * 60_000) })
        .where(eq(notificationDeliveries.id, deliveryId)),
    );
    await handleNotificationJob(fixture.database, notify, fakeQueueMessage(send), NOW);
    expect(await deliveryRow(deliveryId)).toMatchObject({ status: 'sent' });
  });
});

describe('suspended boxes', () => {
  it('send nothing', async () => {
    const classRow = await world.createClass({ startsAt: hoursFromNow(50) });
    await bookedMember(classRow.id);
    await asOwner((context) => cancelClass(context, classRow.id, null));
    await fixture.system((transaction) =>
      transaction
        .update(boxes)
        .set({ status: 'suspended' })
        .where(eq(boxes.id, fixture.boxA.boxId)),
    );
    try {
      await drain();
    } finally {
      await fixture.system((transaction) =>
        transaction.update(boxes).set({ status: 'trial' }).where(eq(boxes.id, fixture.boxA.boxId)),
      );
    }
    expect(notify.channels.push.sent).toHaveLength(0);
  });
});
