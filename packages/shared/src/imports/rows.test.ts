import translations from '../../i18n/es-PY.json';
import { describe, expect, it } from 'vitest';
import { applyColumnMapping, suggestMemberColumns, suggestPlanColumns } from './column-mapping';
import { parseCsv } from './csv';
import { IMPORT_ISSUE_CODES, MEMBER_IMPORT_FIELDS, PLAN_IMPORT_FIELDS } from './fields';
import { normalizeMemberRow, splitFullName } from './member-row';
import { normalizePlanRow } from './plan-row';

describe('parseCsv', () => {
  it('detects semicolons and keeps quoted delimiters and line breaks', () => {
    const rows = parseCsv('﻿Nombre;Notas\r\n"Duarte; Ana";"dice ""hola""\notra línea"\r\n');
    expect(rows).toEqual([
      ['Nombre', 'Notas'],
      ['Duarte; Ana', 'dice "hola"\notra línea'],
    ]);
  });

  it('reads commas and a last line without a line break', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('column mapping', () => {
  it('recognizes Spanish and CrossHero-style headers once each', () => {
    const mapping = suggestMemberColumns([
      'Nombre',
      'Apellidos',
      'DNI',
      'E-mail',
      'Teléfono',
      'Tarifa',
      'Fecha fin tarifa',
      'Sesiones restantes',
      'Deuda',
      'Nombre',
      'Columna rara',
    ]);
    expect(mapping).toEqual([
      'firstName',
      'lastName',
      'documentNumber',
      'email',
      'phone',
      'planName',
      'planEndsOn',
      'classesRemaining',
      'balanceGs',
      null,
      null,
    ]);
    expect(suggestPlanColumns(['Plan', 'Tipo', 'Precio', 'Duración (días)', 'Clases'])).toEqual([
      'name',
      'kind',
      'priceGs',
      'durationDays',
      'classCount',
    ]);
  });

  it('drops ignored columns and empty rows but remembers where each row came from', () => {
    const mapped = applyColumnMapping(
      [
        ['Ana', 'x', ' Duarte '],
        ['', '', ''],
        ['Luis', '', 'Benítez'],
      ],
      ['firstName', null, 'lastName'],
    );
    expect(mapped.rows).toEqual([
      { firstName: 'Ana', lastName: 'Duarte' },
      { firstName: 'Luis', lastName: 'Benítez' },
    ]);
    expect(mapped.sourceIndexes).toEqual([0, 2]);
  });
});

describe('normalizeMemberRow', () => {
  it('reads a complete row', () => {
    const row = normalizeMemberRow({
      firstName: 'Ana',
      lastName: 'Duarte',
      documentNumber: '4.123.456',
      phone: '0981 123 456',
      planName: 'Pack 10',
      planEndsOn: '31/12/2026',
      classesRemaining: '4',
      balanceGs: '₲ 150.000',
    });
    expect(row.errors).toEqual([]);
    expect(row.member).toMatchObject({ documentNumber: '4123456', phone: '+595981123456' });
    expect(row.plan).toEqual({
      planName: 'Pack 10',
      startsOn: null,
      endsOn: '2026-12-31',
      classesRemaining: 4,
    });
    expect(row.balance).toEqual({ amountGs: 150_000, dueOn: null });
  });

  it('splits a full name and warns about it', () => {
    expect(splitFullName('Ana María Duarte Benítez')).toEqual({
      firstName: 'Ana María',
      lastName: 'Duarte Benítez',
    });
    const row = normalizeMemberRow({ fullName: 'Luis Benítez', email: 'luis@mail.com' });
    expect(row.member).toMatchObject({ firstName: 'Luis', lastName: 'Benítez' });
    expect(row.warnings).toEqual([{ field: 'fullName', code: 'name_split' }]);
  });

  it('collects every problem of a row', () => {
    const row = normalizeMemberRow({
      firstName: 'Ana',
      lastName: 'Duarte',
      email: 'no-es-email',
      balanceGs: '-5000',
      planStartsOn: '2026-02-01',
    });
    expect(row.errors).toEqual([
      { field: 'email', code: 'invalid_email' },
      { field: 'documentNumber', code: 'identity_missing' },
      { field: 'planName', code: 'required' },
      { field: 'balanceGs', code: 'negative_amount' },
    ]);
  });

  it('rejects a plan that ends before it starts', () => {
    const row = normalizeMemberRow({
      fullName: 'Ana Duarte',
      documentNumber: '4123456',
      planName: 'Ilimitado',
      planStartsOn: '2026-02-10',
      planEndsOn: '2026-02-01',
    });
    expect(row.errors).toContainEqual({ field: 'planEndsOn', code: 'plan_dates_invalid' });
  });
});

describe('normalizePlanRow', () => {
  it('reads each kind with its limits', () => {
    expect(
      normalizePlanRow({
        name: '3x semana',
        kind: '3x semana',
        priceGs: '250.000',
        durationDays: '30',
        classesPerWeek: '3',
      }).plan,
    ).toEqual({
      name: '3x semana',
      kind: 'weekly_limit',
      priceGs: 250_000,
      durationDays: 30,
      classesPerWeek: 3,
      classCount: null,
    });
    expect(
      normalizePlanRow({
        name: 'Suelta',
        kind: 'Clase suelta',
        priceGs: '40000',
        durationDays: '1',
      }).plan,
    ).toMatchObject({ kind: 'drop_in', classCount: 1 });
  });

  it('rejects missing fields and impossible limits', () => {
    expect(normalizePlanRow({ name: 'X' }).errors.map((issue) => issue.code)).toEqual([
      'required',
      'required',
      'required',
    ]);
    expect(
      normalizePlanRow({
        name: 'Pack',
        kind: 'pack',
        priceGs: '1',
        durationDays: '30',
        classCount: '1',
      }).errors,
    ).toEqual([{ field: 'classCount', code: 'invalid_plan_limits' }]);
  });
});

describe('translations', () => {
  it('name every field and issue code in Spanish (Paraguay)', () => {
    const imports = (
      translations as unknown as { admin: { imports: Record<string, Record<string, string>> } }
    ).admin.imports;
    const missing = [
      ...IMPORT_ISSUE_CODES.filter((issue) => !imports.issues?.[issue]),
      ...MEMBER_IMPORT_FIELDS.filter((field) => !imports.memberFields?.[field]),
      ...PLAN_IMPORT_FIELDS.filter((field) => !imports.planFields?.[field]),
    ];
    expect(missing).toEqual([]);
  });
});
