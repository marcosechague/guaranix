import { z } from 'zod';

export const idSchema = z.uuid();

/** Whole guaraníes. The currency has no minor unit, so fractions are always a bug. */
export const guaraniAmountSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const positiveGuaraniAmountSchema = guaraniAmountSchema.positive();

/** Calendar date as `YYYY-MM-DD`, matching Postgres `date`. */
export const calendarDateSchema = z.iso.date();

/** Local wall-clock time as `HH:MM` (24 h). */
export const localTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'Expected HH:MM in 24-hour format' });

/** Paraguayan numbers are stored in E.164, e.g. `+595981123456`. */
export const phoneE164Schema = z.string().regex(/^\+[1-9]\d{7,14}$/, {
  error: 'Expected an E.164 phone number such as +595981123456',
});

// Trim before validating, so a pasted " Ana@Mail.com " is accepted and stored as ana@mail.com.
export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

const GOOGLE_MAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

/**
 * The form an account is stored and looked up by. Gmail ignores dots and
 * "+tags" in the name, and Google may report either spelling, so
 * `Marcos.Echague+box@googlemail.com` and `marcosechague@gmail.com` are one
 * account. Other providers may treat those characters as significant.
 */
export function canonicalAccountEmail(email: string): string {
  const lowered = email.trim().toLowerCase();
  const at = lowered.lastIndexOf('@');
  if (at < 1) return lowered;
  const domain = lowered.slice(at + 1);
  if (!GOOGLE_MAIL_DOMAINS.has(domain)) return lowered;
  const name = lowered.slice(0, at).split('+')[0]?.replaceAll('.', '') ?? '';
  return `${name}@gmail.com`;
}

/** An email that identifies an account (sign-up, login, box owner). */
export const accountEmailSchema = emailSchema.transform(canonicalAccountEmail);

/** Paraguayan cédula: digits only, no dots. */
export const documentNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{5,10}$/, { error: 'Expected 5 to 10 digits without dots' });

export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const nameSchema = z.string().trim().min(1).max(120);

/** Object key in R2, never a public URL. */
export const fileKeySchema = z.string().min(1).max(512);

export const weekdaySchema = z.number().int().min(0).max(6);

export function isOnOrAfter(later: string, earlier: string): boolean {
  return later >= earlier;
}
