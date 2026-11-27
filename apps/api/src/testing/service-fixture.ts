import { withBoxScope, withSystemScope, type ScopedTransaction } from '@guaranix/db';
import { boxUsers, members, users } from '@guaranix/db/schema';
import { createTestDatabase, seedDemoBox, seedPlatform } from '@guaranix/db/testing';
import type { BoxRole } from '@guaranix/shared/domain';
import type { ServiceContext } from '../services/context';

type TestDatabase = Awaited<ReturnType<typeof createTestDatabase>>['database'];

export interface TestBox {
  boxId: string;
  /** One user per role; `member` also has a member profile. */
  userIds: Record<BoxRole, string>;
  memberId: string;
}

async function seedBox(database: TestDatabase, slug: string, platformPlanId: string) {
  const demo = await seedDemoBox(database, { slug, platformPlanId });
  return withSystemScope(database, async (transaction) => {
    const extra = await transaction
      .insert(users)
      .values([
        { email: `admin@${slug}.local`, fullName: 'Admin Test' },
        { email: `reception@${slug}.local`, fullName: 'Recepción Test' },
        { email: `member@${slug}.local`, fullName: 'Alumna Test' },
      ])
      .returning({ id: users.id });
    const [admin, reception, member] = extra.map((row) => row.id);
    if (!admin || !reception || !member) throw new Error('Test users were not created');
    await transaction.insert(boxUsers).values([
      { boxId: demo.boxId, userId: admin, role: 'box_admin' },
      { boxId: demo.boxId, userId: reception, role: 'reception' },
      { boxId: demo.boxId, userId: member, role: 'member' },
    ]);
    const [profile] = await transaction
      .insert(members)
      .values({ boxId: demo.boxId, userId: member, firstName: 'Alumna', lastName: 'Test' })
      .returning({ id: members.id });
    if (!profile) throw new Error('Test member was not created');
    const userIds: Record<BoxRole, string> = {
      box_owner: demo.ownerId,
      box_admin: admin,
      coach: demo.coachId,
      reception,
      member,
    };
    return { boxId: demo.boxId, userIds, memberId: profile.id } satisfies TestBox;
  });
}

/** PGlite with migrations and two seeded boxes, A and B, for service tests. */
export async function createServiceFixture() {
  const { database, close } = await createTestDatabase();
  const platform = await seedPlatform(database);
  const boxA = await seedBox(database, 'box-a', platform.basePlanId);
  const boxB = await seedBox(database, 'box-b', platform.basePlanId);

  /** Runs `work` as `role` inside `box`, like a real request would. */
  function as<T>(
    box: TestBox,
    role: BoxRole,
    work: (context: ServiceContext) => Promise<T>,
    now = new Date(),
  ): Promise<T> {
    const auth = { boxId: box.boxId, userId: box.userIds[role], role };
    return withBoxScope(database, auth, (transaction) => work({ transaction, auth, now }));
  }

  /** Unrestricted access for assertions about what was written. */
  function system<T>(work: (transaction: ScopedTransaction) => Promise<T>): Promise<T> {
    return withSystemScope(database, work);
  }

  return { database, close, boxA, boxB, as, system };
}

export type ServiceFixture = Awaited<ReturnType<typeof createServiceFixture>>;
