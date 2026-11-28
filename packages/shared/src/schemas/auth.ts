import { z } from 'zod';
import { BOX_ROLES, BOX_STATUSES } from '../domain/enums';
import { emailSchema, idSchema, nameSchema } from './common';
import { pushUnsubscribeInputSchema } from './notifications';

/** NIST 800-63B: length over composition rules. 128 caps hashing cost. */
export const passwordSchema = z.string().min(8).max(128);

/** Cloudflare Turnstile response token. Absent only when captcha is off (development). */
export const captchaTokenSchema = z.string().min(1).max(2048).optional();

export const signupSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  captchaToken: captchaTokenSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  // Old passwords may predate the current policy, so only bound the length.
  password: z.string().min(1).max(128),
  captchaToken: captchaTokenSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
  captchaToken: captchaTokenSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(128),
  password: passwordSchema,
});

export const setPasswordSchema = z.object({
  /** Required when the account already has a password. */
  currentPassword: z.string().min(1).max(128).optional(),
  newPassword: passwordSchema,
});

export const selectBoxSchema = z.object({ boxId: idSchema });

/** Optional body of `POST /auth/logout`: this browser's push endpoint, to unlink it. */
export const logoutSchema = z.object({
  pushEndpoint: pushUnsubscribeInputSchema.shape.endpoint.optional(),
});
export type LogoutInput = z.infer<typeof logoutSchema>;

export const membershipSchema = z.object({
  boxId: idSchema,
  boxName: z.string(),
  role: z.enum(BOX_ROLES),
  /** Suspended or removed boxes stay listed so the apps can say why they are closed. */
  boxStatus: z.enum(BOX_STATUSES),
});

/** A platform admin working inside a box for support. */
export const impersonationSchema = z.object({
  boxId: idSchema,
  boxName: z.string(),
  endsAt: z.string(),
  /** Always true: support can look but never change a box's data (see `docs/decisions/0006`). */
  readOnly: z.literal(true),
});

export const sessionSchema = z.object({
  user: z.object({
    id: idSchema,
    email: z.string().nullable(),
    fullName: z.string(),
    isPlatformAdmin: z.boolean(),
  }),
  hasPassword: z.boolean(),
  googleLinked: z.boolean(),
  memberships: z.array(membershipSchema),
  activeBoxId: idSchema.nullable(),
  impersonation: impersonationSchema.nullable(),
  /** Echo it in the `X-CSRF-Token` header on every request that changes data. */
  csrfToken: z.string(),
});

/** Public settings the login screens need before anyone is logged in. */
export const authConfigSchema = z.object({
  googleEnabled: z.boolean(),
  /** Null when captcha is off, so the apps skip the widget. */
  turnstileSiteKey: z.string().nullable(),
});

export const AUTH_ERROR_CODES = [
  'invalid_credentials',
  'email_taken',
  'captcha_failed',
  'rate_limited',
  'invalid_reset_token',
  'current_password_required',
  'recent_sign_in_required',
  'google_already_linked',
  'google_not_configured',
  'google_failed',
  'last_sign_in_method',
  'not_a_member',
  'box_suspended',
  'box_cancelled',
  'impersonation_read_only',
  'unauthenticated',
  'forbidden',
  'csrf_failed',
  'validation_failed',
  'internal_error',
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type Impersonation = z.infer<typeof impersonationSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type AuthConfig = z.infer<typeof authConfigSchema>;
