import { z } from 'zod';
import { documentNumberSchema } from './common';
import { rucSchema } from './box';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable();

/**
 * Where members send transfers and QR payments. Every field is optional: a box
 * may only take QR, or only an alias. Empty strings are stored as null.
 */
export const boxPaymentDetailsSchema = z.object({
  bankName: optionalText(80),
  accountNumber: optionalText(40),
  /** Transfer alias: a phone, cédula, RUC or email registered with the bank. */
  alias: optionalText(80),
  holderName: optionalText(120),
  /** RUC (`80012345-6`) or cédula (digits only) of the account holder. */
  holderDocument: z
    .union([rucSchema, documentNumberSchema, z.literal('')])
    .transform((value) => (value === '' ? null : value))
    .nullable(),
  note: optionalText(240),
});

export type BoxPaymentDetailsInput = z.input<typeof boxPaymentDetailsSchema>;
export type BoxPaymentDetailsFields = z.output<typeof boxPaymentDetailsSchema>;

/** What the API returns: the fields plus whether a QR image is uploaded. */
export type BoxPaymentDetails = BoxPaymentDetailsFields & { hasQr: boolean };

/** The QR is a picture members scan or save, so no PDFs here. */
export const PAYMENT_QR_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PAYMENT_QR_MAX_BYTES = 2 * 1024 * 1024;

export function paymentQrFileProblem(file: {
  type: string;
  size: number;
}): 'payment_qr_type' | 'payment_qr_too_large' | null {
  if (!(PAYMENT_QR_CONTENT_TYPES as readonly string[]).includes(file.type)) {
    return 'payment_qr_type';
  }
  return file.size > PAYMENT_QR_MAX_BYTES ? 'payment_qr_too_large' : null;
}

export function hasPaymentDetails(details: BoxPaymentDetails): boolean {
  return (
    details.hasQr ||
    [details.bankName, details.accountNumber, details.alias, details.holderName].some(Boolean)
  );
}
