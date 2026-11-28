import { type PlatformBoxActivity, t, translateAuditAction } from '@guaranix/shared';
import { Badge } from '@guaranix/ui';
import { formatInstantDate } from '../../lib/box-status';

export function BoxActivity({ activity }: { activity: PlatformBoxActivity[] }) {
  if (activity.length === 0) {
    return <p className="text-sm text-text-secondary">{t('platform.box.activityEmpty')}</p>;
  }
  return (
    <ol className="flex flex-col">
      {activity.map((entry) => (
        <li
          key={entry.id}
          className="flex items-start justify-between gap-3 border-t border-divider py-3 first:border-t-0 first:pt-0"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-text">
              {translateAuditAction(entry.action)}
            </span>
            <span className="text-xs text-text-secondary">
              {[entry.actorName, formatInstantDate(entry.createdAt)].filter(Boolean).join(' · ')}
            </span>
          </div>
          {entry.impersonated ? (
            <Badge tone="outline">{t('platform.box.byImpersonation')}</Badge>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
