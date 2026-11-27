import { readdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import translations from '@guaranix/shared/i18n/es-PY.json';
import { describe, expect, it } from 'vitest';

const directory = dirname(fileURLToPath(import.meta.url));

/** Every code a service can return, read from the source so a new one can't be missed. */
function serviceErrorCodes(): string[] {
  const codes = new Set(['invalid_input', 'forbidden']);
  for (const file of readdirSync(directory).filter((name) => /^[a-z-]+\.ts$/.test(name))) {
    const source = readFileSync(`${directory}/${file}`, 'utf8');
    for (const [, helper, code] of source.matchAll(
      /\b(notFound|conflict|unprocessable)\('([a-z_]+)'\)/g,
    )) {
      codes.add(helper === 'notFound' ? `${code}_not_found` : (code ?? ''));
    }
  }
  return [...codes].sort();
}

describe('service error codes', () => {
  it('all have a Spanish (Paraguay) message', () => {
    const messages = (translations as { errors: Record<string, string> }).errors;
    const missing = serviceErrorCodes().filter((code) => !messages[code]);
    expect(missing).toEqual([]);
  });
});
