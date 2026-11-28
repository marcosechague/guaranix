import { z } from 'zod';
import { idSchema } from './common';
import { latitudeSchema, longitudeSchema } from './location';

/**
 * What the entrance device read from the member's QR. Only the shape is
 * checked here; the API verifies the signature and expiry.
 */
export const checkInSchema = z.object({
  pass: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[A-Za-z0-9._-]+$/),
});

export type CheckInInput = z.infer<typeof checkInSchema>;

/** Members can be checked in from this long before a class until it ends. */
export const CHECK_IN_OPENS_MINUTES_BEFORE = 30;

/** The coach adds someone who came without booking. */
export const walkInSchema = z.object({ memberId: idSchema });

export type WalkInInput = z.infer<typeof walkInSchema>;

/** What the member's phone sends after reading the poster on the wall: its code and where it is. */
export const wallCheckInSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9._-]+$/),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  accuracyMeters: z.number().min(0).max(100_000),
});

export type WallCheckInInput = z.infer<typeof wallCheckInSchema>;

/** The poster for one location: what its QR opens. */
export interface WallQrView {
  url: string;
  locationName: string;
}

/** Why the entrance said no. Each one has a message under `checkIn.denied`. */
export const CHECK_IN_DENIALS = [
  'member_inactive',
  'fee_overdue',
  'no_class_now',
  'class_full',
  'waitlisted',
  'no_valid_plan',
  'plan_excludes_program',
  'no_credits_left',
  'weekly_limit_reached',
] as const;

export type CheckInDenial = (typeof CHECK_IN_DENIALS)[number];

// Response shapes (JSON: dates are ISO strings).

/** The member's entry QR. It expires soon, so the app asks for a new one before then. */
export interface CheckInPassView {
  pass: string;
  expiresAt: string;
}

export interface CheckInMember {
  id: string;
  firstName: string;
  lastName: string;
}

export interface CheckInClass {
  id: string;
  programName: string;
  startsAt: string;
}

/** What the entrance device shows after reading a QR. */
export type CheckInResult =
  | {
      outcome: 'checked_in' | 'already_checked_in';
      member: CheckInMember;
      class: CheckInClass;
      /** True when the member had not booked and got a free spot at the door. */
      walkIn: boolean;
    }
  | {
      outcome: 'denied';
      reason: CheckInDenial;
      member: CheckInMember;
      class: CheckInClass | null;
      /** Overdue debt, when that is the reason. */
      owedGs: number | null;
    };
