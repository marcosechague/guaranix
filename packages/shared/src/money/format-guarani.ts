const THOUSANDS_GROUP = /\B(?=(\d{3})+(?!\d))/g;

/**
 * Formats an integer amount of guaraníes for display, e.g. `300000` → `₲ 300.000`.
 * Amounts are always whole guaraníes; anything else is a bug upstream, so it throws.
 */
export function formatGuarani(amount: number): string {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`Guaraní amounts must be safe integers, received ${amount}`);
  }
  const digits = Math.abs(amount).toString().replace(THOUSANDS_GROUP, '.');
  const sign = amount < 0 ? '-' : '';
  return `${sign}₲ ${digits}`;
}
