import { eq } from 'drizzle-orm';
import { boxUsers, boxes, classes, members, programs, users } from '@guaranix/db/schema';
import { createPlanSchema } from '@guaranix/shared/schemas';
import type { BoxRole } from '@guaranix/shared/domain';
import { assignMemberPlan } from '../services/member-plans';
import { createPlan } from '../services/plans';
import type { ServiceContext } from '../services/context';
import type { ServiceFixture, TestBox } from './service-fixture';

/** A Monday at 09:00 in Asunción. Far from the seeded demo data, so tests own that week. */
export const NOW = new Date('2031-03-03T12:00:00Z');
export const TODAY = '2031-03-03';
const HOUR_MS = 60 * 60 * 1000;

export const hoursFromNow = (hours: number) => new Date(NOW.getTime() + hours * HOUR_MS);

let counter = 0;

/** Helpers that act in one box at a fixed clock. */
export function bookingWorld(fixture: ServiceFixture, box: TestBox) {
  const as = <T>(role: BoxRole, work: (context: ServiceContext) => Promise<T>, now = NOW) =>
    fixture.as(box, role, work, now);

  async function programId(name = 'CrossFit') {
    const row = await fixture.system(async (transaction) => {
      const rows = await transaction.select().from(programs).where(eq(programs.boxId, box.boxId));
      return rows.find((candidate) => candidate.name === name);
    });
    if (!row) throw new Error(`Program ${name} missing`);
    return row.id;
  }

  async function createClass(options: { startsAt: Date; capacity?: number; program?: string }) {
    const program = await programId(options.program);
    const [classRow] = await fixture.system((transaction) =>
      transaction
        .insert(classes)
        .values({
          boxId: box.boxId,
          programId: program,
          startsAt: options.startsAt,
          endsAt: new Date(options.startsAt.getTime() + HOUR_MS),
          capacity: options.capacity ?? 10,
        })
        .returning(),
    );
    if (!classRow) throw new Error('Class was not created');
    return classRow;
  }

  async function createPlanOf(input: Record<string, unknown>) {
    counter += 1;
    return as('box_owner', (context) =>
      createPlan(
        context,
        createPlanSchema.parse({
          durationDays: 30,
          priceGs: 100_000,
          ...input,
          name: `Plan ${counter}`,
        }),
      ),
    );
  }

  /** A member with a login (so they can act as `member`) and an optional plan. */
  async function memberWith(plan?: { id: string }, startsOn = TODAY) {
    counter += 1;
    const userId = await fixture.system(async (transaction) => {
      const [user] = await transaction
        .insert(users)
        .values({ email: `m${counter}@${box.boxId}.local`, fullName: `Member ${counter}` })
        .returning({ id: users.id });
      if (!user) throw new Error('User was not created');
      await transaction
        .insert(boxUsers)
        .values({ boxId: box.boxId, userId: user.id, role: 'member' });
      return user.id;
    });
    const [member] = await fixture.system((transaction) =>
      transaction
        .insert(members)
        .values({ boxId: box.boxId, userId, firstName: 'Member', lastName: `N${counter}` })
        .returning(),
    );
    if (!member) throw new Error('Member was not created');
    const memberPlan = plan
      ? await as('reception', (context) =>
          assignMemberPlan(context, { memberId: member.id, planId: plan.id, startsOn }),
        )
      : null;
    /** Runs `work` signed in as this member. */
    const act = <T>(work: (context: ServiceContext) => Promise<T>, now = NOW) =>
      withMember(fixture, box, userId, work, now);
    return { member, memberPlan, act, userId };
  }

  async function setPolicy(policy: Partial<typeof boxes.$inferInsert>) {
    await fixture.system((transaction) =>
      transaction.update(boxes).set(policy).where(eq(boxes.id, box.boxId)),
    );
  }

  return { as, createClass, createPlanOf, memberWith, setPolicy, programId };
}

function withMember<T>(
  fixture: ServiceFixture,
  box: TestBox,
  userId: string,
  work: (context: ServiceContext) => Promise<T>,
  now: Date,
) {
  return fixture.as({ ...box, userIds: { ...box.userIds, member: userId } }, 'member', work, now);
}
