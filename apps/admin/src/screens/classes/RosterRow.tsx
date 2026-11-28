import { t } from '@guaranix/shared';
import type { RosterEntry } from '@guaranix/shared/api';
import { Avatar, Badge, SegmentedControl } from '@guaranix/ui';

type AttendanceChoice = 'attended' | 'no_show' | 'booked';

export interface RosterRowProps {
  entry: RosterEntry;
  /** Attendance can be marked once the class has started. */
  canMark: boolean;
  disabled: boolean;
  onMark: (status: 'attended' | 'no_show') => void;
}

export function RosterRow({ entry, canMark, disabled, onMark }: RosterRowProps) {
  const name = `${entry.firstName} ${entry.lastName}`;
  const current: AttendanceChoice =
    entry.status === 'attended' || entry.status === 'no_show' ? entry.status : 'booked';
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Avatar firstName={entry.firstName} lastName={entry.lastName} size="sm" />
      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
      {canMark ? (
        <SegmentedControl<AttendanceChoice>
          label={`${t('admin.classes.markAttendance')}: ${name}`}
          value={current}
          onChange={(value) => !disabled && value !== 'booked' && onMark(value)}
          options={[
            { value: 'attended', label: t('admin.classes.checkedIn') },
            { value: 'no_show', label: t('admin.classes.missing') },
          ]}
        />
      ) : (
        <Badge tone="outline">{t('admin.classes.pending')}</Badge>
      )}
    </li>
  );
}
