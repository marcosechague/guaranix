import { readFileSync } from 'node:fs';

/** Reads a wrangler.jsonc: drops comments and trailing commas, keeping `//` inside strings. */
export function readJsonc(path) {
  const text = readFileSync(path, 'utf8');
  let output = '';
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (char === '"') {
      const end = endOfString(text, index);
      output += text.slice(index, end);
      index = end;
    } else if (text.startsWith('//', index)) {
      index = text.indexOf('\n', index);
      if (index === -1) index = text.length;
    } else if (text.startsWith('/*', index)) {
      index = text.indexOf('*/', index) + 2;
    } else {
      output += char;
      index += 1;
    }
  }
  return JSON.parse(output.replace(/,(\s*[}\]])/g, '$1'));
}

function endOfString(text, start) {
  let index = start + 1;
  while (index < text.length && text[index] !== '"') {
    index += text[index] === '\\' ? 2 : 1;
  }
  return index + 1;
}
