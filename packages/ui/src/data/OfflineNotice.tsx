import { dateOfInstant, formatShortDate, formatTimeIn, t } from '@guaranix/shared';
import { useQueryClient } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react';
import { useBoxClock } from './box';
import { newestDataAt } from './offline-cache';
import { useOnlineStatus } from './use-online-status';

function savedLabel(timeZone: string, savedAt: number, today: string): string {
  const instant = new Date(savedAt);
  const time = formatTimeIn(timeZone, instant);
  const date = dateOfInstant(timeZone, instant);
  return date === today ? time : `${formatShortDate(date)} ${time}`;
}

/** Tells the member the screen shows saved data, and from when, while there is no connection. */
export function OfflineNotice() {
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  const { timeZone, today } = useBoxClock();
  if (online) return null;
  const savedAt = newestDataAt(queryClient);
  return (
    <p
      role="status"
      className="flex items-center justify-center gap-2 border-b border-warning bg-warning-soft px-4 py-2 text-center text-sm font-medium text-text"
    >
      <WifiOff aria-hidden="true" size={16} className="shrink-0 text-warning" />
      {savedAt
        ? t('common.offline.withData', { when: savedLabel(timeZone, savedAt, today) })
        : t('common.offline.noData')}
    </p>
  );
}
