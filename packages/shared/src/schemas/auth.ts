import { z } from 'zod';
import { BOX_ROLES } from '../domain/enums';
import { emailSchema, idSchema, nameSchema } from './common';

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

export const membershipSchema = z.object({
  boxId: idSchema,
  boxName: z.string(),
  role: z.enum(BOX_ROLES),
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
  'google_already_linked',
  'google_not_configured',
  'google_failed',
  'last_sign_in_method',
  'not_a_member',
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
export type Session = z.infer<typeof sessionSchema>;
export type AuthConfig = z.infer<typeof authConfigSchema>;
