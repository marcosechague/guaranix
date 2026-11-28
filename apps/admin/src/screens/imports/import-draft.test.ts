import { suggestMemberColumns, t } from '@guaranix/shared';
import { describe, expect, it } from 'vitest';
import {
  buildRequest,
  createDraft,
  detectSource,
  mappingHasName,
  pickSheets,
} from './import-draft';
import { cellToText } from './read-spreadsheet';

const members = {
  name: 'Alumnos',
  rows: [
    ['Nombre', 'Apellido', 'Cédula', 'Saldo'],
    ['Ana', 'Duarte', '4.123.456', '150.000'],
    ['', '', '', ''],
    ['Luis', 'Benítez', '5234567', ''],
  ],
};
const plans = {
  name: 'Planes',
  rows: [
    ['Plan', 'Tipo', 'Precio', 'Duración'],
    ['Ilimitado', 'Ilimitado', '350.000', '30'],
  ],
};

describe('import draft', () => {
  it('takes members from the first sheet and plans from the one named Planes', () => {
    expect(pickSheets([plans, members])).toEqual({ members, plans });
    expect(pickSheets([members])).toEqual({ members, plans: null });
    expect(pickSheets([{ name: 'Vacía', rows: [['Nombre']] }])).toEqual({
      members: null,
      plans: null,
    });
  });

  it('suggests the mapping and builds the request with spreadsheet line numbers', () => {
    const draft = createDraft('alumnos.xlsx', [members, plans]);
    expect(draft?.memberMapping).toEqual(['firstName', 'lastName', 'documentNumber', 'balanceGs']);
    if (!draft) throw new Error('Draft expected');
    expect(mappingHasName(draft.memberMapping)).toBe(true);
    const { request, lines } = buildRequest(draft, {
      balanceDescription: 'Saldo',
      skipInvalidRows: false,
    });
    expect(request.members).toEqual([
      { firstName: 'Ana', lastName: 'Duarte', documentNumber: '4.123.456', balanceGs: '150.000' },
      { firstName: 'Luis', lastName: 'Benítez', documentNumber: '5234567' },
    ]);
    expect(lines).toEqual([2, 4]);
    expect(request.plans).toEqual([
      { name: 'Ilimitado', kind: 'Ilimitado', priceGs: '350.000', durationDays: '30' },
    ]);
  });

  it('recognizes a CrossHero-style export', () => {
    expect(detectSource(['Nombre', 'Apellidos', 'Email', 'Tarifa', 'Sesiones restantes'])).toBe(
      'crosshero',
    );
    expect(detectSource(['Nombre', 'Apellido', 'Plan'])).toBe('spreadsheet');
  });

  it('maps every column of the downloadable template', () => {
    const headers = t('admin.imports.upload.templateHeaders').split(';');
    expect(suggestMemberColumns(headers)).not.toContain(null);
  });

  it('turns spreadsheet cells into text', () => {
    expect(cellToText(new Date(Date.UTC(2026, 11, 31)))).toBe('2026-12-31');
    expect(cellToText(300000)).toBe('300000');
    expect(cellToText(true)).toBe('active');
    expect(cellToText(null)).toBe('');
    expect(cellToText('  Ana ')).toBe('Ana');
  });
});
