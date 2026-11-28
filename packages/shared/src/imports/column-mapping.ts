import type { MemberImportField, PlanImportField } from './fields';
import { normalizeText } from './text';

/**
 * Header names seen in Paraguayan spreadsheets and in CrossHero exports
 * ("Apellidos", "DNI", "Tarifa", "Sesiones restantes"). The CrossHero names
 * are inferred from its Spanish interface, not from a verified export, so the
 * wizard always lets the user fix the mapping.
 */
const MEMBER_HEADER_SYNONYMS: Record<MemberImportField, string[]> = {
  firstName: ['nombre', 'nombres', 'first name', 'name'],
  lastName: ['apellido', 'apellidos', 'last name', 'surname'],
  fullName: [
    'nombre completo',
    'nombre y apellido',
    'nombre y apellidos',
    'apellido y nombre',
    'alumno',
    'alumna',
    'atleta',
    'cliente',
    'socio',
    'full name',
  ],
  documentNumber: [
    'cedula',
    'ci',
    'c i',
    'nro de cedula',
    'numero de cedula',
    'nro cedula',
    'documento',
    'nro documento',
    'dni',
    'nif',
    'document',
  ],
  email: ['email', 'e mail', 'correo', 'correo electronico', 'mail'],
  phone: ['telefono', 'celular', 'movil', 'whatsapp', 'tel', 'phone', 'nro de telefono'],
  birthDate: ['fecha de nacimiento', 'fecha nacimiento', 'nacimiento', 'cumpleanos', 'birth date'],
  joinedOn: [
    'fecha de alta',
    'alta',
    'fecha alta',
    'fecha de inscripcion',
    'inscripcion',
    'fecha de registro',
    'miembro desde',
    'socio desde',
  ],
  status: ['estado', 'status', 'activo'],
  externalRef: ['id', 'codigo', 'id externo', 'nro de socio', 'numero de socio', 'id atleta'],
  notes: ['notas', 'observaciones', 'comentarios', 'notes'],
  planName: ['plan', 'tarifa', 'membresia', 'plan actual', 'tarifa actual', 'bono', 'plan name'],
  planStartsOn: [
    'inicio del plan',
    'inicio plan',
    'fecha de inicio',
    'fecha inicio',
    'inicio',
    'fecha inicio tarifa',
    'desde',
  ],
  planEndsOn: [
    'vencimiento',
    'fecha de vencimiento',
    'vence',
    'vencimiento del plan',
    'fin',
    'fecha fin',
    'fecha fin tarifa',
    'hasta',
    'caducidad',
  ],
  classesRemaining: [
    'clases restantes',
    'creditos',
    'creditos restantes',
    'sesiones restantes',
    'sesiones disponibles',
    'clases disponibles',
  ],
  balanceGs: [
    'saldo',
    'deuda',
    'saldo pendiente',
    'debe',
    'monto adeudado',
    'pendiente',
    'saldo gs',
  ],
  balanceDueOn: ['vencimiento de la deuda', 'fecha de la deuda', 'fecha deuda', 'deuda desde'],
};

const PLAN_HEADER_SYNONYMS: Record<PlanImportField, string[]> = {
  name: ['nombre', 'plan', 'tarifa', 'nombre del plan', 'name'],
  kind: ['tipo', 'tipo de plan', 'kind', 'modalidad'],
  priceGs: ['precio', 'monto', 'importe', 'valor', 'precio gs', 'cuota', 'price'],
  durationDays: [
    'duracion',
    'dias',
    'duracion dias',
    'duracion en dias',
    'vigencia',
    'vigencia dias',
  ],
  classesPerWeek: ['clases por semana', 'veces por semana', 'por semana', 'sesiones por semana'],
  classCount: ['cantidad de clases', 'clases', 'sesiones', 'creditos', 'cantidad de sesiones'],
};

/** Which field each column feeds; `null` means the column is ignored. */
export type ColumnMapping<Field extends string> = (Field | null)[];

function suggest<Field extends string>(
  headers: string[],
  synonyms: Record<Field, string[]>,
): ColumnMapping<Field> {
  const lookup = new Map<string, Field>();
  for (const [field, names] of Object.entries(synonyms) as [Field, string[]][]) {
    for (const name of names) lookup.set(name, field);
  }
  const taken = new Set<Field>();
  return headers.map((header) => {
    const field = lookup.get(normalizeText(header));
    if (!field || taken.has(field)) return null;
    taken.add(field);
    return field;
  });
}

export function suggestMemberColumns(headers: string[]): ColumnMapping<MemberImportField> {
  return suggest(headers, MEMBER_HEADER_SYNONYMS);
}

export function suggestPlanColumns(headers: string[]): ColumnMapping<PlanImportField> {
  return suggest(headers, PLAN_HEADER_SYNONYMS);
}

/**
 * Turns spreadsheet rows into field-keyed rows, dropping ignored columns and
 * empty rows. `sourceIndexes` says which input row each output row came from,
 * so issues can point at the line the user sees in their spreadsheet.
 */
export function applyColumnMapping<Field extends string>(
  rows: string[][],
  mapping: ColumnMapping<Field>,
): { rows: Partial<Record<Field, string>>[]; sourceIndexes: number[] } {
  const mapped: Partial<Record<Field, string>>[] = [];
  const sourceIndexes: number[] = [];
  rows.forEach((cells, index) => {
    const row: Partial<Record<Field, string>> = {};
    mapping.forEach((field, column) => {
      const value = cells[column]?.trim();
      if (field && value) row[field] = value;
    });
    if (Object.keys(row).length === 0) return;
    mapped.push(row);
    sourceIndexes.push(index);
  });
  return { rows: mapped, sourceIndexes };
}
