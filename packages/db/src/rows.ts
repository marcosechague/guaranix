/** Rows of a raw `execute`: postgres-js returns an array, PGlite returns `{ rows }`. */
export function rowsOf<Row>(result: unknown): Row[] {
  if (Array.isArray(result)) return result as Row[];
  return (result as { rows: Row[] }).rows;
}
