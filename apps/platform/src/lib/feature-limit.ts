/** Text field value to a monthly limit: empty means no limit, anything else must be a whole number. */
export function parseMonthlyLimit(value: string): number | null | 'invalid' {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (!/^\d+$/.test(trimmed)) return 'invalid';
  return Number(trimmed);
}

export const limitText = (limit: number | null) => (limit === null ? '' : String(limit));
