import { z } from 'zod';
import { BUSINESS_TYPES, MOVEMENT_CATEGORIES, PLAN_KINDS } from '../domain/enums';
import { bookingPolicySchema, boxSlugSchema } from '../schemas/box';
import {
  guaraniAmountSchema,
  hexColorSchema,
  localTimeSchema,
  nameSchema,
  phoneE164Schema,
  weekdaySchema,
} from '../schemas/common';

/** Matches the `boxes.booking_opens_hours_before` default. */
export const DEFAULT_BOOKING_OPENS_HOURS_BEFORE = 24;

const keySchema = z.string().regex(/^[a-z][a-zA-Z0-9]{0,30}$/);

export const setupProgramSchema = z.object({
  key: keySchema,
  name: nameSchema,
  color: hexColorSchema,
});

/** One time of day repeated on several weekdays: how owners think about a timetable. */
export const setupSlotSchema = z.object({
  programKey: keySchema,
  startTime: localTimeSchema,
  weekdays: z.array(weekdaySchema).min(1).max(7),
  durationMinutes: z
    .number()
    .int()
    .min(1)
    .max(24 * 60),
  capacity: z.number().int().min(1).max(1000),
});

export const setupPlanSchema = z.object({
  name: nameSchema,
  kind: z.enum(PLAN_KINDS),
  priceGs: guaraniAmountSchema.max(100_000_000),
  classesPerWeek: z.number().int().min(1).max(14).nullable().default(null),
  classCount: z.number().int().min(1).max(500).nullable().default(null),
  durationDays: z.number().int().min(1).max(366),
  /** Empty means every program. */
  programKeys: z.array(keySchema).max(20).default([]),
});

export const setupMovementSchema = z.object({
  name: nameSchema,
  category: z.enum(MOVEMENT_CATEGORIES),
});

/**
 * Everything a new box starts with. Structural limits only: whether the
 * timetable and prices make sense is `reviewBoxSetup`'s job, so the screen can
 * explain each problem instead of rejecting the whole form.
 */
export const boxSetupSchema = z.object({
  programs: z.array(setupProgramSchema).min(1).max(20),
  slots: z.array(setupSlotSchema).max(200),
  plans: z.array(setupPlanSchema).max(40),
  movements: z.array(setupMovementSchema).max(200).default([]),
});

/** The self-service sign-up form, sent once at the end. */
export const boxSignupSchema = z.object({
  name: nameSchema,
  slug: boxSlugSchema.optional(),
  city: z.string().trim().min(1).max(80),
  phone: phoneE164Schema.nullable().default(null),
  businessType: z.enum(BUSINESS_TYPES),
  setup: boxSetupSchema,
  /** How early members may book; 24 h by default so nobody books the whole week. */
  bookingOpensHoursBefore: bookingPolicySchema.shape.bookingOpensHoursBefore.default(
    DEFAULT_BOOKING_OPENS_HOURS_BEFORE,
  ),
  /** The owner saw the warnings (odd prices, early hours) and wants to save anyway. */
  acceptWarnings: z.boolean().default(false),
});

export type SetupProgram = z.infer<typeof setupProgramSchema>;
export type SetupSlot = z.infer<typeof setupSlotSchema>;
export type SetupPlan = z.input<typeof setupPlanSchema>;
export type BoxSetup = z.input<typeof boxSetupSchema>;
export type BoxSignupInput = z.input<typeof boxSignupSchema>;
