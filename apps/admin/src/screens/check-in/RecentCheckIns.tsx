import { formatTimeIn, t } from '@guaranix/shared';
import { Badge, Card, DividedList, Eyebrow } from '@guaranix/ui';
import { useBoxClock } from '@guaranix/ui/data';
import type { RecentEntry } from './use-check-in-desk';

/** Who came through this entrance since the screen opened, newest first. */
export function RecentCheckIns({ entries }: { entries: RecentEntry[] }) {
  const { timeZone } = useBoxClock();
  return (
    <Card spacing="compact">
      <Eyebrow>{t('admin.checkIn.recentTitle')}</Eyebrow>
      {entries.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('admin.checkIn.recentEmpty')}</p>
      ) : (
        <DividedList className="border-0 bg-transparent">
          {entries.map(({ at, result }) => (
            <li key={at} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0 truncate font-medium">
                {result.member.firstName} {result.member.lastName}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-sm text-text-secondary tabular-nums">
                  {formatTimeIn(timeZone, new Date(at))}
                </span>
                {result.outcome === 'denied' ? (
                  <Badge tone="warning" dot>
                    {t('admin.checkIn.recentDenied')}
                  </Badge>
                ) : (
                  <Badge tone="success" dot>
                    {t('admin.checkIn.recentIn')}
                  </Badge>
                )}
              </span>
            </li>
          ))}
        </DividedList>
      )}
    </Card>
  );
}
