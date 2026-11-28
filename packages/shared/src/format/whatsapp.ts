/**
 * A Paraguayan phone as WhatsApp wants it: digits only, with the 595 country
 * code. Accepts `0981 123 456`, `+595 981 123456` or `981123456`.
 */
export function paraguayanWhatsappNumber(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  const national = digits.startsWith('595')
    ? digits.slice(3)
    : digits.startsWith('0')
      ? digits.slice(1)
      : digits;
  // Mobile numbers are 9 digits starting with 9 (e.g. 981 123 456).
  return /^9\d{8}$/.test(national) ? `595${national}` : null;
}

/** `wa.me` link that opens a chat with the text ready to send; null without a mobile number. */
export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  const number = paraguayanWhatsappNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}
