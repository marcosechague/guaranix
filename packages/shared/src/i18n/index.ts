import esPY from '../../i18n/es-PY.json';
import { createTranslator } from './translate';

export { createTranslator } from './translate';
export type { MessageKey, TranslationParams } from './translate';

export type TranslationKey = Parameters<typeof t>[0];

export const t = createTranslator(esPY);
