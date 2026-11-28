import { formatGuarani, t } from '@guaranix/shared';
import type { RosterEntry } from '@guaranix/shared/api';
import { Avatar, Badge, SegmentedControl } from '@guaranix/ui';

type AttendanceChoice = 'attended' | 'no_show' | 'booked';

export interface RosterRowProps {
  entry: RosterEntry;
  /** "Came" opens 30 minutes before the class, like the entrance. */
  canMark: boolean;
  /** "Didn't come" only once the class started. */
  canMarkMissing: boolean;
  disabled: boolean;
  onMark: (status: 'attended' | 'no_show') => void;
}

/** What the entrance would have said: the coach decides, but sees it. */
function EntryWarning({ entry }: { entry: RosterEntry }) {
  if (entry.memberInactive) {
    return <Badge tone="warning">{t('admin.classes.warnings.inactive')}</Badge>;
  }
  if (entry.owedGs > 0) {
    return (
      <Badge tone="warning">
        {t('admin.classes.warnings.owes', { amount: formatGuarani(entry.owedGs) })}
      </Badge>
    );
  }
  return null;
}

export function RosterRow({ entry, canMark, canMarkMissing, disabled, onMark }: RosterRowProps) {
  const name = `${entry.firstName} ${entry.lastName}`;
  const current: AttendanceChoice =
    entry.status === 'attended' || entry.status === 'no_show' ? entry.status : 'booked';
  const options = [
    { value: 'attended' as const, label: t('admin.classes.checkedIn') },
    ...(canMarkMissing ? [{ value: 'no_show' as const, label: t('admin.classes.missing') }] : []),
  ];
  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5">
      <Avatar firstName={entry.firstName} lastName={entry.lastName} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className="max-w-full truncate font-medium">{name}</span>
        <EntryWarning entry={entry} />
      </span>
      {canMark ? (
        <SegmentedControl<AttendanceChoice>
          label={`${t('admin.classes.markAttendance')}: ${name}`}
          value={current}
          onChange={(value) => !disabled && value !== 'booked' && onMark(value)}
          options={options}
        />
      ) : (
        <Badge tone="outline">{t('admin.classes.pending')}</Badge>
      )}
    </li>
  );
}
