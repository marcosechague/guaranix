/** `2026-12-31` → `31/12/2026`, the way the spreadsheet showed it. */
export function formatCalendarDate(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}
