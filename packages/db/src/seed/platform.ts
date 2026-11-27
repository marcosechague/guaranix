import { platformPlans, users } from '../schema';
import { withSystemScope, type SchemaDatabase } from '../scope';

/** GuaraniX's own price list (PRD §5) and a platform admin account. */
export async function seedPlatform(database: SchemaDatabase) {
  return withSystemScope(database, async (transaction) => {
    const [base, founders] = await transaction
      .insert(platformPlans)
      .values([
        {
          code: 'base',
          name: 'Plan base',
          monthlyPriceGs: 199_000,
          extraLocationMonthlyPriceGs: 99_000,
        },
        {
          code: 'founders',
          name: 'Precio fundador',
          monthlyPriceGs: 169_000,
          extraLocationMonthlyPriceGs: 99_000,
        },
      ])
      .returning({ id: platformPlans.id });
    const [admin] = await transaction
      .insert(users)
      .values({ email: 'admin@guaranix.local', fullName: 'GuaraniX Admin', isPlatformAdmin: true })
      .returning({ id: users.id });
    if (!base || !founders || !admin) throw new Error('Platform seed did not return ids');
    return { basePlanId: base.id, foundersPlanId: founders.id, platformAdminId: admin.id };
  });
}
