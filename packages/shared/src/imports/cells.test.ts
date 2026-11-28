import { describe, expect, it } from 'vitest';
import {
  parseCountCell,
  parseDateCell,
  parseDocumentCell,
  parseGuaraniCell,
  parsePhoneCell,
  parsePlanKindCell,
  parseStatusCell,
} from './cells';

const value = <T>(result: { ok: true; value: T } | { ok: false }) =>
  result.ok ? result.value : undefined;
const code = (result: { ok: boolean; code?: string }) => (result.ok ? undefined : result.code);

describe('parseGuaraniCell', () => {
  it.each([
    ['300000', 300_000],
    ['300.000', 300_000],
    ['₲ 300.000', 300_000],
    ['300.000 Gs.', 300_000],
    ['1.250.000', 1_250_000],
    ['300,000', 300_000],
    ['300000.00', 300_000],
    ['300000,0', 300_000],
    ['0', 0],
  ])('reads %s as whole guaraníes', (text, amount) => {
    expect(value(parseGuaraniCell(text))).toBe(amount);
  });

  it('rejects fractions, negatives and text', () => {
    expect(code(parseGuaraniCell('300000.50'))).toBe('invalid_amount');
    expect(code(parseGuaraniCell('30.00'))).toBe(undefined);
    expect(code(parseGuaraniCell('3.5'))).toBe('invalid_amount');
    expect(code(parseGuaraniCell('-150.000'))).toBe('negative_amount');
    expect(code(parseGuaraniCell('mucho'))).toBe('invalid_amount');
    expect(code(parseGuaraniCell('99999999999999999999'))).toBe('invalid_amount');
  });
});

describe('parseDateCell', () => {
  it.each([
    ['2026-12-31', '2026-12-31'],
    ['2026-12-31T00:00:00.000Z', '2026-12-31'],
    ['31/12/2026', '2026-12-31'],
    ['1/2/2026', '2026-02-01'],
    ['31-12-26', '2026-12-31'],
    ['31.12.1985', '1985-12-31'],
    ['15/03/85', '1985-03-15'],
    ['46022', '2025-12-31'],
  ])('reads %s', (text, date) => {
    expect(value(parseDateCell(text))).toBe(date);
  });

  it('rejects impossible and month-first dates', () => {
    expect(code(parseDateCell('31/02/2026'))).toBe('invalid_date');
    expect(code(parseDateCell('12/31/2026'))).toBe('invalid_date');
    expect(code(parseDateCell('ayer'))).toBe('invalid_date');
  });
});

describe('identity cells', () => {
  it('strips dots from a cédula', () => {
    expect(value(parseDocumentCell('4.123.456'))).toBe('4123456');
    expect(code(parseDocumentCell('ABC123'))).toBe('invalid_document');
  });

  it.each([
    ['0981 123 456', '+595981123456'],
    ['0981-123-456', '+595981123456'],
    ['981123456', '+595981123456'],
    ['595981123456', '+595981123456'],
    ['+595 (981) 123456', '+595981123456'],
    ['021 600 700', '+59521600700'],
  ])('turns the phone %s into E.164', (text, phone) => {
    expect(value(parsePhoneCell(text))).toBe(phone);
  });

  it('rejects a phone that is too short', () => {
    expect(code(parsePhoneCell('123'))).toBe('invalid_phone');
  });
});

describe('words', () => {
  it.each([
    ['Ilimitado', 'unlimited'],
    ['Open Box libre', 'unlimited'],
    ['3x semana', 'weekly_limit'],
    ['2 veces por semana', 'weekly_limit'],
    ['Pack 10 clases', 'class_pack'],
    ['Bono 8 sesiones', 'class_pack'],
    ['Clase suelta', 'drop_in'],
    ['drop_in', 'drop_in'],
    ['weekly_limit', 'weekly_limit'],
  ])('reads the plan kind %s', (text, kind) => {
    expect(value(parsePlanKindCell(text))).toBe(kind);
  });

  it('reads member statuses and counts', () => {
    expect(value(parseStatusCell('Activo'))).toBe('active');
    expect(value(parseStatusCell('De baja'))).toBe('inactive');
    expect(code(parseStatusCell('quizás'))).toBe('invalid_status');
    expect(value(parseCountCell('8'))).toBe(8);
    expect(value(parseCountCell('8.0'))).toBe(8);
    expect(code(parseCountCell('-1'))).toBe('invalid_number');
    expect(code(parseCountCell('2.5'))).toBe('invalid_number');
  });
});
