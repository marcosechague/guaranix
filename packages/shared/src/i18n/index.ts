import esPY from '../../i18n/es-PY.json';
import { createTranslator } from './translate';

export { createTranslator } from './translate';
export type { MessageKey, TranslationParams } from './translate';

export type TranslationKey = Parameters<typeof t>[0];

export const t = createTranslator(esPY);

type ApiErrorKey = keyof typeof esPY.errors;

/** Text for an API `{ error: code }`; unknown codes fall back to a generic message. */
export function translateApiError(code: string): string {
  const key: ApiErrorKey = code in esPY.errors ? (code as ApiErrorKey) : 'internal_error';
  return t(`errors.${key}`);
}
