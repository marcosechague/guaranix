import { and, eq } from 'drizzle-orm';
import {
  boxes,
  boxUsers,
  classSchedules,
  classes,
  memberPlans,
  members,
  plans,
  users,
} from '../schema';
import {
  withBoxScope,
  withSystemScope,
  type SchemaDatabase,
  type ScopedTransaction,
} from '../scope';
import { applyBoxTemplate } from '../templates/paraguayan-box';
import { seedActivity } from './demo-activity';
import { addMinutes, localDate, localDateTime, weekdayOf } from './calendar';

const DEMO_MEMBERS = [
  ['Rodrigo', 'Benítez', '4123456'],
  ['Lucía', 'Giménez', '5234567'],
  ['Matías', 'Acosta', '3345678'],
  ['Fernanda', 'Ortiz', '6456789'],
  ['Diego', 'Villalba', '4567890'],
] as const;

export interface DemoBoxOptions {
  slug?: string;
  name?: string;
  platformPlanId?: string | null;
  days?: number;
}

/**
 * Creates a box from the Paraguayan template plus staff, members and a week of
 * activity, touching every tenant table. Used by `pnpm db:seed` and by tests.
 */
export async function seedDemoBox(database: SchemaDatabase, options: DemoBoxOptions = {}) {
  const slug = options.slug ?? 'box-demo-asuncion';
  const { boxId, ownerId, coachId } = await withSystemScope(database, async (transaction) => {
    const [box] = await transaction
      .insert(boxes)
      .values({
        slug,
        name: options.name ?? 'Box Demo Asunción',
        city: 'Asunción',
        platformPlanId: options.platformPlanId ?? null,
        paymentBankName: 'Banco Continental',
        paymentAccountNumber: '1234567890',
        paymentAlias: '0981123456',
        paymentHolderName: 'Box Demo Asunción S.A.',
        paymentHolderDocument: '80012345-6',
        paymentNote: 'Poné tu nombre en el concepto de la transferencia.',
      })
      .returning({ id: boxes.id });
    if (box) {
      // `pnpm demo:receipts` stores a sample image under this key in the local R2.
      await transaction
        .update(boxes)
        .set({ paymentQrFileKey: `boxes/${box.id}/payment-qr/seed.png` })
        .where(eq(boxes.id, box.id));
    }
    const [owner, coach] = await transaction
      .insert(users)
      .values([
        { email: `owner@${slug}.local`, fullName: 'Dueño Demo' },
        { email: `coach@${slug}.local`, fullName: 'Coach Demo' },
      ])
      .returning({ id: users.id });
    if (!box || !owner || !coach) throw new Error('Demo box seed did not return ids');
    await transaction.insert(boxUsers).values([
      { boxId: box.id, userId: owner.id, role: 'box_owner' },
      { boxId: box.id, userId: coach.id, role: 'coach' },
    ]);
    return { boxId: box.id, ownerId: owner.id, coachId: coach.id };
  });

  const memberCount = await withBoxScope(
    database,
    { boxId, userId: ownerId },
    async (transaction) => {
      await applyBoxTemplate(transaction, boxId, { validFrom: localDate() });
      await generateClasses(transaction, boxId, coachId, options.days ?? 7);
      const memberIds = await seedMembers(transaction, boxId);
      await seedActivity(transaction, { boxId, ownerId, coachId, memberIds });
      return memberIds.length;
    },
  );

  return { boxId, ownerId, coachId, memberCount };
}

async function generateClasses(
  transaction: ScopedTransaction,
  boxId: string,
  coachUserId: string,
  days: number,
) {
  const schedules = await transaction.select().from(classSchedules);
  const rows = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = localDate(offset);
    for (const schedule of schedules.filter((slot) => slot.weekday === weekdayOf(date))) {
      const startsAt = localDateTime(date, schedule.startTime);
      rows.push({
        boxId,
        programId: schedule.programId,
        scheduleId: schedule.id,
        coachUserId,
        startsAt,
        endsAt: addMinutes(startsAt, schedule.durationMinutes),
        capacity: schedule.capacity,
      });
    }
  }
  if (rows.length > 0) await transaction.insert(classes).values(rows);
}

async function seedMembers(transaction: ScopedTransaction, boxId: string) {
  const created = await transaction
    .insert(members)
    .values(
      DEMO_MEMBERS.map(([firstName, lastName, documentNumber]) => ({
        boxId,
        firstName,
        lastName,
        documentNumber,
        phone: `+59598${documentNumber}`,
      })),
    )
    .returning({ id: members.id });
  const [unlimited] = await transaction
    .select()
    .from(plans)
    .where(and(eq(plans.kind, 'unlimited'), eq(plans.name, 'Ilimitado')));
  if (!unlimited) throw new Error('Template plan "Ilimitado" missing');
  await transaction.insert(memberPlans).values(
    created.map(({ id }) => ({
      boxId,
      memberId: id,
      planId: unlimited.id,
      startsOn: localDate(-10),
      endsOn: localDate(20),
      priceGs: unlimited.priceGs,
    })),
  );
  return created.map(({ id }) => id);
}
