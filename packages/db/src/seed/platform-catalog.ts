import type { platformPlans } from '../schema';

/**
 * GuaraniX's starting price list (PRD §5). After the first deploy the superadmin
 * edits plans from the platform app; the bootstrap only inserts missing codes.
 */
export const PLATFORM_PLAN_CATALOG = [
  {
    code: 'base',
    name: 'Plan base',
    monthlyPriceGs: 199_000,
    extraLocationMonthlyPriceGs: 99_000,
    description: 'Alumnos ilimitados, todo el núcleo y Brodi con límite.',
  },
  {
    code: 'founders',
    name: 'Precio fundador',
    monthlyPriceGs: 169_000,
    extraLocationMonthlyPriceGs: 99_000,
    description: 'De por vida para los primeros centros.',
    boxLimit: 20,
  },
] as const satisfies (typeof platformPlans.$inferInsert)[];
