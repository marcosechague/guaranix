import { z } from 'zod';
import { BOOKING_STATUSES, CLASS_STATUSES } from '../domain/enums';
import {
  calendarDateSchema,
  hexColorSchema,
  idSchema,
  isOnOrAfter,
  localTimeSchema,
  nameSchema,
  weekdaySchema,
} from './common';

export const programSchema = z.object({
  id: idSchema,
  boxId: idSchema,
  name: nameSchema,
  description: z.string().trim().max(500).nullable(),
  color: hexColorSchema.nullable(),
  isActive: z.boolean(),
});

export const createProgramSchema = programSchema
  .pick({ name: true, description: true, color: true })
  .partial({ description: true, color: true });

const capacitySchema = z.number().int().min(1).max(200);
const durationMinutesSchema = z.number().int().min(15).max(240);

export const classScheduleSchema = z
  .object({
    programId: idSchema,
    coachUserId: idSchema.nullable().default(null),
    weekday: weekdaySchema,
    startTime: localTimeSchema,
    durationMinutes: durationMinutesSchema,
    capacity: capacitySchema,
    validFrom: calendarDateSchema,
    validUntil: calendarDateSchema.nullable().default(null),
  })
  .refine(
    (schedule) =>
      schedule.validUntil === null || isOnOrAfter(schedule.validUntil, schedule.validFrom),
    { error: 'validUntil must not be before validFrom', path: ['validUntil'] },
  )
  .refine((schedule) => endsSameDay(schedule.startTime, schedule.durationMinutes), {
    error: 'A class must end before midnight',
    path: ['durationMinutes'],
  });

function endsSameDay(startTime: string, durationMinutes: number): boolean {
  const [hours = 0, minutes = 0] = startTime.split(':').map(Number);
  return hours * 60 + minutes + durationMinutes <= 24 * 60;
}

export const classSessionSchema = z
  .object({
    programId: idSchema,
    coachUserId: idSchema.nullable().default(null),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    capacity: capacitySchema,
    status: z.enum(CLASS_STATUSES).default('scheduled'),
    cancellationReason: z.string().trim().max(500).nullable().default(null),
  })
  .refine((session) => session.endsAt > session.startsAt, {
    error: 'endsAt must be after startsAt',
    path: ['endsAt'],
  });

export const bookingSchema = z.object({
  id: idSchema,
  boxId: idSchema,
  classId: idSchema,
  memberId: idSchema,
  memberPlanId: idSchema.nullable(),
  status: z.enum(BOOKING_STATUSES),
  waitlistPosition: z.number().int().min(1).nullable(),
});

export const createBookingSchema = bookingSchema.pick({ classId: true, memberId: true });

export type Program = z.infer<typeof programSchema>;
export type CreateProgramInput = z.infer<typeof createProgramSchema>;
export type ClassScheduleInput = z.input<typeof classScheduleSchema>;
export type ClassSessionInput = z.input<typeof classSessionSchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const updateProgramSchema = z
  .object({
    name: nameSchema,
    description: z.string().trim().max(500).nullable(),
    color: hexColorSchema.nullable(),
    isActive: z.boolean(),
  })
  .partial();

export const endScheduleSchema = z.object({ lastDate: calendarDateSchema });

export const generateClassesSchema = z.object({
  from: calendarDateSchema,
  days: z.number().int().min(1).max(62),
});

export const listClassesQuerySchema = z.object({
  from: calendarDateSchema,
  to: calendarDateSchema,
});

export const updateClassSessionSchema = z
  .object({ capacity: capacitySchema, coachUserId: idSchema.nullable() })
  .partial();

export const cancelClassSchema = z.object({
  reason: z.string().trim().max(500).nullable().default(null),
});

/** Members send only the class; staff also say who they book for. */
export const bookClassSchema = z.object({
  classId: idSchema,
  memberId: idSchema.optional(),
});

export const cancelBookingSchema = z.object({
  /** Staff only: waive the late-cancel penalty. */
  forgiveLateCancel: z.boolean().optional(),
});

export const attendanceSchema = z.object({
  entries: z
    .array(z.object({ bookingId: idSchema, status: z.enum(['attended', 'no_show']) }))
    .min(1)
    .max(200),
});

export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;
export type BookClassInput = z.infer<typeof bookClassSchema>;
export type AttendanceInput = z.infer<typeof attendanceSchema>;

/** Changing a weekly slot; it also applies to that slot's upcoming classes. */
export const updateScheduleSchema = z
  .object({ capacity: capacitySchema, coachUserId: idSchema.nullable() })
  .partial();

export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
