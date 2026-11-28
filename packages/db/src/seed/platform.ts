import { platformPlanFeatures, platformPlans, users } from '../schema';
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
      ])
      .returning({ id: platformPlans.id });
    const [admin] = await transaction
      .insert(users)
      .values({ email: 'admin@guaranix.local', fullName: 'GuaraniX Admin', isPlatformAdmin: true })
      .returning({ id: users.id });
    if (!base || !founders || !admin) throw new Error('Platform seed did not return ids');
    // Examples only: which plans include AI import or WhatsApp, and how much, is decided in the superadmin.
    await transaction.insert(platformPlanFeatures).values([
      { platformPlanId: founders.id, feature: 'ai_import', enabled: true, monthlyLimit: 10 },
      { platformPlanId: founders.id, feature: 'whatsapp', enabled: true, monthlyLimit: 200 },
    ]);
    return { basePlanId: base.id, foundersPlanId: founders.id, platformAdminId: admin.id };
  });
}
