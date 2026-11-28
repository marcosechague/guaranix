/**
 * Minimal RFC 4180 reader for CSV exports. Spreadsheets set to Spanish save
 * with `;`, so the delimiter is whichever of `,` `;` or tab appears most in
 * the header line.
 */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"' && cell === '') quoted = true;
    else if (character === delimiter) {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += character;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(text: string): string {
  const header = text.slice(0, text.search(/\r?\n|$/));
  const counts = [',', ';', '\t'].map((delimiter) => ({
    delimiter,
    count: header.split(delimiter).length - 1,
  }));
  counts.sort((first, second) => second.count - first.count);
  return counts[0]?.count ? counts[0].delimiter : ',';
}
