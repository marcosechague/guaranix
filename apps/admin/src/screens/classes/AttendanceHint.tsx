import { CHECK_IN_OPENS_MINUTES_BEFORE, t } from '@guaranix/shared';

export function AttendanceHint({
  scheduled,
  open,
  listAllowed,
}: {
  scheduled: boolean;
  open: boolean;
  listAllowed: boolean;
}) {
  if (!scheduled) return null;
  const text = !listAllowed
    ? t('admin.classes.attendanceOff')
    : open
      ? t('admin.classes.attendanceHint')
      : t('admin.classes.attendanceLater', { minutes: CHECK_IN_OPENS_MINUTES_BEFORE });
  return <p className="text-sm text-text-secondary">{text}</p>;
}
