/** Guaraníes have no cents; processors still want two decimals ("150000.00"). */
export function formatProviderAmount(amountGs: number): string {
  if (!Number.isSafeInteger(amountGs) || amountGs <= 0) {
    throw new RangeError('Amounts are positive whole guaraníes');
  }
  return `${amountGs}.00`;
}

/** "150000.00" → 150000. Anything with real cents is not a guaraní amount. */
export function parseProviderAmount(value: unknown): number | null {
  const text = typeof value === 'number' ? value.toFixed(2) : value;
  if (typeof text !== 'string') return null;
  const match = /^(\d+)(?:\.0{1,2})?$/.exec(text.trim());
  if (!match?.[1]) return null;
  const amount = Number(match[1]);
  return Number.isSafeInteger(amount) ? amount : null;
}
