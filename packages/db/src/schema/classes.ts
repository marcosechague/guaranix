import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { bookingStatusEnum, classStatusEnum } from './enums';
import { boxUsers, members } from './people';
import { memberPlans } from './plans';
import { sameBoxReference, tenantColumns, tenantIsolationPolicy, tenantKey } from './tenant';

/** A kind of class the box offers, e.g. CrossFit or Open Box. */
export const programs = pgTable(
  'programs',
  {
    ...tenantColumns(),
    name: text().notNull(),
    description: text(),
    color: text(),
    isActive: boolean().notNull().default(true),
  },
  (table) => [
    tenantKey('programs', table.boxId, table.id),
    unique('programs_box_id_name_unique').on(table.boxId, table.name),
    tenantIsolationPolicy(table.boxId),
  ],
);

/** A weekly recurring slot; classes are generated from it. Times are box-local. */
export const classSchedules = pgTable(
  'class_schedules',
  {
    ...tenantColumns(),
    programId: uuid().notNull(),
    coachUserId: uuid(),
    /** 0 = Sunday … 6 = Saturday, like `extract(dow)`. */
    weekday: smallint().notNull(),
    startTime: time().notNull(),
    durationMinutes: integer().notNull(),
    capacity: integer().notNull(),
    validFrom: date().notNull(),
    validUntil: date(),
  },
  (table) => [
    tenantKey('class_schedules', table.boxId, table.id),
    sameBoxReference(
      'class_schedules_program_fk',
      [table.boxId, table.programId],
      [programs.boxId, programs.id],
    ),
    sameBoxReference(
      'class_schedules_coach_fk',
      [table.boxId, table.coachUserId],
      [boxUsers.boxId, boxUsers.userId],
    ),
    check('class_schedules_weekday_valid', sql`${table.weekday} between 0 and 6`),
    check('class_schedules_duration_positive', sql`${table.durationMinutes} > 0`),
    check('class_schedules_capacity_positive', sql`${table.capacity} > 0`),
    check(
      'class_schedules_valid_range',
      sql`${table.validUntil} is null or ${table.validUntil} >= ${table.validFrom}`,
    ),
    tenantIsolationPolicy(table.boxId),
  ],
);

/** One concrete class on a given day, with its own capacity and coach. */
export const classes = pgTable(
  'classes',
  {
    ...tenantColumns(),
    programId: uuid().notNull(),
    scheduleId: uuid(),
    coachUserId: uuid(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    capacity: integer().notNull(),
    status: classStatusEnum().notNull().default('scheduled'),
    cancellationReason: text(),
  },
  (table) => [
    tenantKey('classes', table.boxId, table.id),
    sameBoxReference(
      'classes_program_fk',
      [table.boxId, table.programId],
      [programs.boxId, programs.id],
    ),
    sameBoxReference(
      'classes_schedule_fk',
      [table.boxId, table.scheduleId],
      [classSchedules.boxId, classSchedules.id],
    ),
    sameBoxReference(
      'classes_coach_fk',
      [table.boxId, table.coachUserId],
      [boxUsers.boxId, boxUsers.userId],
    ),
    // Generating classes twice from the same schedule must not duplicate them.
    unique('classes_schedule_id_starts_at_unique').on(table.scheduleId, table.startsAt),
    index('classes_box_id_starts_at_idx').on(table.boxId, table.startsAt),
    check('classes_ends_after_start', sql`${table.endsAt} > ${table.startsAt}`),
    check('classes_capacity_positive', sql`${table.capacity} > 0`),
    tenantIsolationPolicy(table.boxId),
  ],
);

/** A member's spot (or waitlist place) in a class. One row per member per class. */
export const bookings = pgTable(
  'bookings',
  {
    ...tenantColumns(),
    classId: uuid().notNull(),
    memberId: uuid().notNull(),
    /** Plan the credit was taken from, so a cancellation can give it back. */
    memberPlanId: uuid(),
    status: bookingStatusEnum().notNull(),
    waitlistPosition: integer(),
    cancelledAt: timestamp({ withTimezone: true }),
    checkedInAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    tenantKey('bookings', table.boxId, table.id),
    sameBoxReference(
      'bookings_class_fk',
      [table.boxId, table.classId],
      [classes.boxId, classes.id],
    ),
    sameBoxReference(
      'bookings_member_fk',
      [table.boxId, table.memberId],
      [members.boxId, members.id],
    ),
    sameBoxReference(
      'bookings_member_plan_fk',
      [table.boxId, table.memberPlanId],
      [memberPlans.boxId, memberPlans.id],
    ),
    unique('bookings_class_id_member_id_unique').on(table.classId, table.memberId),
    unique('bookings_class_id_waitlist_position_unique').on(table.classId, table.waitlistPosition),
    index('bookings_box_id_member_id_idx').on(table.boxId, table.memberId),
    check(
      'bookings_waitlist_position_only_when_waitlisted',
      sql`(${table.status} = 'waitlisted') = (${table.waitlistPosition} is not null)`,
    ),
    tenantIsolationPolicy(table.boxId),
  ],
);
