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

const compactMillions = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 1 });

/** Big totals for dashboards: `4_800_000` → `₲ 4,8 M`. Below a million it is exact. */
export function formatGuaraniCompact(amount: number): string {
  if (Math.abs(amount) < 1_000_000) return formatGuarani(amount);
  return `₲ ${compactMillions.format(amount / 1_000_000)} M`;
}
