import { formatTimeIn, t } from '@guaranix/shared';
import type { ClassListItem } from '@guaranix/shared/api';
import { Badge, ColorDot, ProgressBar, TileButton } from '@guaranix/ui';

export interface ClassTileProps {
  item: ClassListItem;
  timeZone: string;
  onOpen: () => void;
}

export function ClassTile({ item, timeZone, onOpen }: ClassTileProps) {
  const cancelled = item.status === 'cancelled';
  return (
    <TileButton onClick={onOpen} className={cancelled ? 'opacity-60' : undefined}>
      <span className="flex items-center justify-between gap-2">
        <span className="font-display text-base font-bold tabular-nums">
          {formatTimeIn(timeZone, item.startsAt)}
        </span>
        {cancelled ? (
          <Badge tone="neutral">{t('admin.classes.cancelledBadge')}</Badge>
        ) : item.waitlistCount > 0 ? (
          <Badge tone="warning">+{item.waitlistCount}</Badge>
        ) : null}
      </span>
      <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
        <ColorDot color={item.programColor} />
        <span className="truncate">{item.programName}</span>
      </span>
      {cancelled ? null : (
        <span className="flex items-center gap-2">
          <ProgressBar
            className="flex-1"
            value={item.takenSpots}
            max={item.capacity}
            label={t('common.spotsLabel')}
            tone={item.spotsLeft === 0 ? 'warning' : 'accent'}
          />
          <span className="text-micro text-text-secondary tabular-nums">
            {t('admin.classes.bookedCount', { taken: item.takenSpots, capacity: item.capacity })}
          </span>
        </span>
      )}
    </TileButton>
  );
}
