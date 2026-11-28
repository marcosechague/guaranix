/** wa.me link with a prefilled message; null when there is no usable phone. */
export function whatsappUrl(phone: string | null, message: string): string | null {
  const digits = phone?.replace(/\D/g, '') ?? '';
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
