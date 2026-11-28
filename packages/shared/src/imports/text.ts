/** Lowercase, no accents, single spaces: how headers and names are compared. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Cell text without surrounding or doubled spaces; empty cells become null. */
export function cleanCell(text: string | undefined): string | null {
  if (text === undefined) return null;
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned === '' ? null : cleaned;
}
