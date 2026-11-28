import { describe, expect, it } from 'vitest';
import translations from '../../i18n/es-PY.json';
import { SETUP_ISSUE_CODES } from './review-setup';

describe('setup issue codes', () => {
  it('all have a Spanish (Paraguay) message', () => {
    const messages: Record<string, string> = translations.onboarding.issues;
    expect(SETUP_ISSUE_CODES.filter((code) => !messages[code])).toEqual([]);
  });
});
