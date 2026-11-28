import { z } from 'zod';
import { BOX_STATUSES, BUSINESS_TYPES } from '../domain/enums';
import { boxSlugSchema } from './box';
import { emailSchema, guaraniAmountSchema, idSchema, nameSchema } from './common';

/** GuaraniX's own plans (PRD §5). Prices are data the superadmin edits, never code. */
export const platformPlanInputSchema = z.object({
  code: z
    .string()
    .regex(/^[a-z0-9_]+$/)
    .min(2)
    .max(40),
  name: nameSchema,
  description: z.string().trim().max(240).nullable().default(null),
  monthlyPriceGs: guaraniAmountSchema.max(10_000_000),
  extraLocationMonthlyPriceGs: guaraniAmountSchema.max(10_000_000),
  boxLimit: z.number().int().min(1).max(10_000).nullable().default(null),
  isActive: z.boolean().default(true),
});

export const updatePlatformPlanSchema = platformPlanInputSchema.omit({ code: true }).partial();

const cityShape = z.string().trim().min(1).max(80);

/** A box created by the superadmin; the owner gets an account if they have none. */
export const createPlatformBoxSchema = z.object({
  name: nameSchema,
  slug: boxSlugSchema.optional(),
  city: cityShape.nullable().default(null),
  businessType: z.enum(BUSINESS_TYPES).default('functional_box'),
  platformPlanId: idSchema,
  ownerEmail: emailSchema,
  ownerName: nameSchema,
  trialDays: z.number().int().min(0).max(90).default(30),
  /** Loads the Paraguayan template (programs, schedule, plans) for the business type. */
  applyTemplate: z.boolean().default(true),
});

export const updatePlatformBoxSchema = z
  .object({
    platformPlanId: idSchema,
    extraLocations: z.number().int().min(0).max(50),
    trialEndsAt: z.coerce.date().nullable(),
  })
  .partial();

/** Suspending or removing a box needs a reason its staff will see. */
export const boxStatusChangeSchema = z.object({ reason: z.string().trim().min(3).max(240) });

export const PLATFORM_BOX_FILTERS = ['all', 'trial', 'active', 'suspended', 'cancelled'] as const;

export const platformBoxListQuerySchema = z.object({
  status: z.enum(PLATFORM_BOX_FILTERS).default('all'),
  search: z.string().trim().max(80).optional(),
});

export const platformBoxSummarySchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  city: z.string().nullable(),
  businessType: z.enum(BUSINESS_TYPES),
  status: z.enum(BOX_STATUSES),
  statusReason: z.string().nullable(),
  trialEndsAt: z.string().nullable(),
  createdAt: z.string(),
  platformPlan: z.object({ id: idSchema, name: z.string(), code: z.string() }).nullable(),
  extraLocations: z.number().int(),
  /** What the box pays GuaraniX per month on its current plan. */
  monthlyFeeGs: z.number().int(),
  activeMembers: z.number().int(),
  owner: z.object({ fullName: z.string(), email: z.string().nullable() }).nullable(),
});

export const platformMetricsSchema = z.object({
  /** Monthly recurring revenue from paying (active) boxes. */
  mrrGs: z.number().int(),
  /** What trial boxes would add if they all convert. */
  trialMrrGs: z.number().int(),
  boxes: z.object({
    active: z.number().int(),
    trial: z.number().int(),
    suspended: z.number().int(),
    cancelled: z.number().int(),
    trialEndingSoon: z.number().int(),
    createdThisMonth: z.number().int(),
    withExtraLocations: z.number().int(),
  }),
  activeMembers: z.number().int(),
});

export type PlatformPlanInput = z.input<typeof platformPlanInputSchema>;
export type UpdatePlatformPlanInput = z.infer<typeof updatePlatformPlanSchema>;
export type CreatePlatformBoxInput = z.input<typeof createPlatformBoxSchema>;
export type UpdatePlatformBoxInput = z.infer<typeof updatePlatformBoxSchema>;
export type PlatformBoxFilter = (typeof PLATFORM_BOX_FILTERS)[number];
export type PlatformBoxSummary = z.infer<typeof platformBoxSummarySchema>;
export type PlatformMetrics = z.infer<typeof platformMetricsSchema>;
