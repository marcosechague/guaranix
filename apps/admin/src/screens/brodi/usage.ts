import { t, type BrodiUsage } from '@guaranix/shared';

/** Questions left this month; null when the plan has no limit. */
export function questionsLeft(usage: BrodiUsage): number | null {
  return usage.monthlyLimit === null ? null : Math.max(0, usage.monthlyLimit - usage.usedThisMonth);
}

export function usageText(usage: BrodiUsage): string {
  const left = questionsLeft(usage);
  if (left === null) return t('admin.brodi.unlimited');
  if (left === 0) return t('admin.brodi.limitReached', { limit: usage.monthlyLimit ?? 0 });
  return left === 1 ? t('admin.brodi.remainingOne') : t('admin.brodi.remaining', { count: left });
}
