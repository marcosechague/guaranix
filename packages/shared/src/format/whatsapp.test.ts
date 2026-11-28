import { describe, expect, it } from 'vitest';
import { paraguayanWhatsappNumber, whatsappLink } from './whatsapp';

describe('WhatsApp numbers', () => {
  it('normalises the usual ways of writing a mobile number', () => {
    for (const phone of ['0981 123 456', '+595 981 123456', '981123456', '595981123456']) {
      expect(paraguayanWhatsappNumber(phone)).toBe('595981123456');
    }
  });

  it('gives up on landlines and junk', () => {
    expect(paraguayanWhatsappNumber('021 123 456')).toBeNull();
    expect(paraguayanWhatsappNumber('')).toBeNull();
    expect(paraguayanWhatsappNumber(null)).toBeNull();
  });

  it('builds a wa.me link with the text encoded', () => {
    expect(whatsappLink('0981123456', 'Pagá acá: https://x.py/a?b=1')).toBe(
      'https://wa.me/595981123456?text=Pag%C3%A1%20ac%C3%A1%3A%20https%3A%2F%2Fx.py%2Fa%3Fb%3D1',
    );
  });
});
