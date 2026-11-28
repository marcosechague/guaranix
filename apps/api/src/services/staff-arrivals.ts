import { boxUsers, staffArrivals, users } from '@guaranix/db/schema';
import { calendarDateIn } from '@guaranix/shared';
import type {
  CheckInPassView,
  StaffArrivalResult,
  StaffArrivalView,
} from '@guaranix/shared/schemas';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { currentBox } from './box-calendar';
import { assertCheckInModeEnabled } from './box-settings';
import { signStaffPass, verifyStaffPass } from './check-in-pass';
import {
  CLASS_STAFF_ROLES,
  MANAGER_ROLES,
  STAFF_ROLES,
  assertRole,
  type ServiceContext,
} from './context';
import { unprocessable } from './errors';

/** The QR a coach or front-desk person shows at the entrance when they arrive. */
export async function issueOwnStaffPass(
  context: ServiceContext,
  secret: string,
): Promise<CheckInPassView> {
  assertRole(context.auth.role, STAFF_ROLES);
  await assertCheckInModeEnabled(context, 'staff');
  const { pass, expiresAt } = await signStaffPass(
    secret,
    context.auth.boxId,
    context.auth.userId,
    context.now,
  );
  return { pass, expiresAt: expiresAt.toISOString() };
}

/** Staff of this box who are still active; anyone else's pass finds nobody. */
async function activeStaff(context: ServiceContext, userId: string) {
  const [row] = await context.transaction
    .select({ id: users.id, fullName: users.fullName })
    .from(boxUsers)
    .innerJoin(users, eq(users.id, boxUsers.userId))
    .where(
      and(
        eq(boxUsers.userId, userId),
        eq(boxUsers.isActive, true),
        inArray(boxUsers.role, [...STAFF_ROLES]),
      ),
    );
  if (!row) throw unprocessable('staff_inactive');
  return row;
}

function nameParts(fullName: string) {
  const [firstName = fullName, ...rest] = fullName.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}

/**
 * The entrance read a staff pass: the first scan of the day is the arrival;
 * scanning again just shows it, so the time never moves.
 */
export async function recordStaffArrival(
  context: ServiceContext,
  secret: string,
  pass: string,
): Promise<StaffArrivalResult> {
  assertRole(context.auth.role, CLASS_STAFF_ROLES);
  await assertCheckInModeEnabled(context, 'staff');
  const userId = await verifyStaffPass(secret, context.auth.boxId, pass, context.now);
  const person = await activeStaff(context, userId);
  const box = await currentBox(context);
  const arrivedOn = calendarDateIn(box.timezone, context.now);
  await context.transaction
    .insert(staffArrivals)
    .values({ boxId: context.auth.boxId, userId, arrivedOn, arrivedAt: context.now })
    .onConflictDoNothing();
  const [arrival] = await context.transaction
    .select()
    .from(staffArrivals)
    .where(and(eq(staffArrivals.userId, userId), eq(staffArrivals.arrivedOn, arrivedOn)));
  if (!arrival) throw new Error('Staff arrival was not saved');
  return {
    outcome: 'staff_arrived',
    member: { id: person.id, ...nameParts(person.fullName) },
    arrivedAt: arrival.arrivedAt.toISOString(),
  };
}

/** Who of the staff arrived on a box day, first come first. Owners and admins only. */
export async function listStaffArrivals(
  context: ServiceContext,
  date: string,
): Promise<StaffArrivalView[]> {
  assertRole(context.auth.role, MANAGER_ROLES);
  const rows = await context.transaction
    .select({
      userId: staffArrivals.userId,
      fullName: users.fullName,
      arrivedAt: staffArrivals.arrivedAt,
    })
    .from(staffArrivals)
    .innerJoin(users, eq(users.id, staffArrivals.userId))
    .where(eq(staffArrivals.arrivedOn, date))
    .orderBy(asc(staffArrivals.arrivedAt));
  return rows.map((row) => ({ ...row, arrivedAt: row.arrivedAt.toISOString() }));
}
