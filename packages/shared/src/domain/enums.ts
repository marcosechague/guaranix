// Single source of truth for enumerated values: the database enums in
// `packages/db` and the Zod schemas below are both built from these tuples.

export const PLATFORM_ROLES = ['platform_admin'] as const;
export const BOX_ROLES = ['box_owner', 'box_admin', 'coach', 'reception', 'member'] as const;
export const ROLES = [...PLATFORM_ROLES, ...BOX_ROLES] as const;

export const BOX_STATUSES = ['trial', 'active', 'suspended', 'cancelled'] as const;
/** Kind of center; picks the sign-up template and, later, the modules it gets. */
export const BUSINESS_TYPES = ['functional_box', 'pilates_studio', 'combat_gym'] as const;
/** Where imported data came from. CrossHero exports are mapped with their own column names. */
export const IMPORT_SOURCES = ['spreadsheet', 'crosshero', 'ai'] as const;

export const MEMBER_STATUSES = ['active', 'inactive'] as const;

export const PLAN_KINDS = ['unlimited', 'weekly_limit', 'class_pack', 'drop_in'] as const;
export const MEMBER_PLAN_STATUSES = ['active', 'paused', 'expired', 'cancelled'] as const;

export const CLASS_STATUSES = ['scheduled', 'cancelled'] as const;
export const BOOKING_STATUSES = [
  'booked',
  'waitlisted',
  'cancelled',
  'late_cancelled',
  'attended',
  'no_show',
] as const;

export const WORKOUT_COMPONENT_KINDS = [
  'warm_up',
  'skill',
  'strength',
  'metcon',
  'accessory',
  'cool_down',
] as const;
export const SCORE_TYPES = [
  'none',
  'time',
  'rounds_reps',
  'reps',
  'load',
  'distance',
  'calories',
  'points',
] as const;
export const TIMER_TYPES = ['none', 'for_time', 'amrap', 'emom', 'tabata'] as const;
export const SCALINGS = ['rx', 'scaled'] as const;
export const MOVEMENT_CATEGORIES = [
  'weightlifting',
  'gymnastics',
  'monostructural',
  'other',
] as const;

export const CHARGE_STATUSES = ['open', 'paid', 'void'] as const;
export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'qr', 'card'] as const;
export const PAYMENT_STATUSES = ['pending_review', 'confirmed', 'rejected', 'refunded'] as const;

/** Paid extras a GuaraniX plan includes, each overridable per box from the superadmin. */
export const FEATURE_FLAGS = ['ai_import', 'card_payments'] as const;
/** AI providers behind `packages/ai`; the superadmin picks one and loads its key. */
export const AI_PROVIDERS = ['anthropic', 'openai', 'gemini'] as const;
/** Card processors behind `packages/payments`. `mock` only works outside production. */
export const PAYMENT_PROVIDERS = ['bancard', 'mock'] as const;
export const PAYMENT_PROVIDER_ENVIRONMENTS = ['sandbox', 'production'] as const;
/** `autopay` charges the saved card from the cron; `link` is a member paying a link. */
export const PAYMENT_ATTEMPT_KINDS = ['autopay', 'link'] as const;
export const PAYMENT_ATTEMPT_STATUSES = [
  'pending',
  'approved',
  'declined',
  'failed',
  'refunded',
] as const;
export const SAVED_CARD_STATUSES = ['pending', 'active', 'removed'] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];
export type BoxRole = (typeof BOX_ROLES)[number];
export type Role = (typeof ROLES)[number];
export type BoxStatus = (typeof BOX_STATUSES)[number];
export type BusinessType = (typeof BUSINESS_TYPES)[number];
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
export type PlanKind = (typeof PLAN_KINDS)[number];
export type MemberPlanStatus = (typeof MEMBER_PLAN_STATUSES)[number];
export type ClassStatus = (typeof CLASS_STATUSES)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type WorkoutComponentKind = (typeof WORKOUT_COMPONENT_KINDS)[number];
export type ScoreType = (typeof SCORE_TYPES)[number];
export type TimerType = (typeof TIMER_TYPES)[number];
export type Scaling = (typeof SCALINGS)[number];
export type MovementCategory = (typeof MOVEMENT_CATEGORIES)[number];
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];
export type AiProviderName = (typeof AI_PROVIDERS)[number];
export type PaymentProviderName = (typeof PAYMENT_PROVIDERS)[number];
export type PaymentProviderEnvironment = (typeof PAYMENT_PROVIDER_ENVIRONMENTS)[number];
export type PaymentAttemptKind = (typeof PAYMENT_ATTEMPT_KINDS)[number];
export type PaymentAttemptStatus = (typeof PAYMENT_ATTEMPT_STATUSES)[number];
export type SavedCardStatus = (typeof SAVED_CARD_STATUSES)[number];
