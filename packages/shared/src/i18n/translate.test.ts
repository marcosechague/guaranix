import { describe, expect, it } from 'vitest';
import { createTranslator } from './translate';

const translate = createTranslator({
  booking: { confirm: 'Reservá tu lugar', greeting: 'Hola, {name}. Tenés {count} clases.' },
});

describe('createTranslator', () => {
  it('returns the message for a nested key', () => {
    expect(translate('booking.confirm')).toBe('Reservá tu lugar');
  });

  it('interpolates named params', () => {
    expect(translate('booking.greeting', { name: 'Daniel', count: 3 })).toBe(
      'Hola, Daniel. Tenés 3 clases.',
    );
  });

  it('leaves unknown placeholders untouched', () => {
    expect(translate('booking.greeting', { name: 'Daniel' })).toBe(
      'Hola, Daniel. Tenés {count} clases.',
    );
  });

  it('falls back to the key when the message is missing', () => {
    // @ts-expect-error unknown keys are rejected at compile time
    expect(translate('booking.missing')).toBe('booking.missing');
  });
});
