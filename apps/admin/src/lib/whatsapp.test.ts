import { describe, expect, it } from 'vitest';
import { whatsappUrl } from './whatsapp';

describe('whatsappUrl', () => {
  it('keeps only digits and encodes the message', () => {
    expect(whatsappUrl('+595 981 123456', 'Hola Ana')).toBe(
      'https://wa.me/595981123456?text=Hola%20Ana',
    );
  });

  it('returns null without a phone', () => {
    expect(whatsappUrl(null, 'Hola')).toBeNull();
    expect(whatsappUrl('123', 'Hola')).toBeNull();
  });
});
