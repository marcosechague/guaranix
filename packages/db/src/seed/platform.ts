import { platformPlanFeatures, platformPlans, users } from '../schema';
import { withSystemScope, type SchemaDatabase } from '../scope';
import { PLATFORM_PLAN_CATALOG } from './platform-catalog';

/** GuaraniX's own price list (PRD §5) and a platform admin account. */
export async function seedPlatform(database: SchemaDatabase) {
  return withSystemScope(database, async (transaction) => {
    const [base, founders] = await transaction
      .insert(platformPlans)
      .values([...PLATFORM_PLAN_CATALOG])
      .returning({ id: platformPlans.id });
    const [admin] = await transaction
      .insert(users)
      .values({ email: 'admin@guaranix.local', fullName: 'GuaraniX Admin', isPlatformAdmin: true })
      .returning({ id: users.id });
    if (!base || !founders || !admin) throw new Error('Platform seed did not return ids');
    // Examples only: which plans include AI import, Brodi or WhatsApp, and how much, is decided in the superadmin.
    await transaction.insert(platformPlanFeatures).values([
      { platformPlanId: founders.id, feature: 'ai_import', enabled: true, monthlyLimit: 10 },
      { platformPlanId: founders.id, feature: 'whatsapp', enabled: true, monthlyLimit: 200 },
      { platformPlanId: founders.id, feature: 'brodi', enabled: true, monthlyLimit: 100 },
    ]);
    return { basePlanId: base.id, foundersPlanId: founders.id, platformAdminId: admin.id };
  });
}
