import { t } from '@guaranix/shared';
import type { Plan } from '@guaranix/shared/api';

/** "3 clases por semana", "10 clases", "Reservá cuando quieras". */
export function planRule(plan: Pick<Plan, 'kind' | 'classesPerWeek' | 'classCount'>): string {
  const count = plan.kind === 'weekly_limit' ? plan.classesPerWeek : plan.classCount;
  return t(`plans.rules.${plan.kind}`, { count: count ?? 0 });
}
