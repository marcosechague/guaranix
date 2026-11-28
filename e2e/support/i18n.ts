import { createRequire } from 'node:module';
import type esPYMessages from '@guaranix/shared/i18n/es-PY.json';

/**
 * The apps' own Spanish texts, so a copy change doesn't break the tests.
 * Read with `require`: Playwright's loader can't import JSON without an
 * import attribute, which the apps' bundlers don't need.
 */
const messages = createRequire(import.meta.url)(
  '@guaranix/shared/i18n/es-PY.json',
) as typeof esPYMessages;

type Leaves<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}`;
}[keyof T & string];

export function t(key: Leaves<typeof esPYMessages>, params: Record<string, string | number> = {}) {
  let node: unknown = messages;
  for (const segment of key.split('.')) node = (node as Record<string, unknown>)[segment];
  if (typeof node !== 'string') throw new Error(`Missing text ${key}`);
  return node.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match));
}
