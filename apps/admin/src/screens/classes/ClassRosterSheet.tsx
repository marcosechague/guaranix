import { formatTimeIn, relativeDayLabel, dateOfInstant, t } from '@guaranix/shared';
import type { ClassListItem } from '@guaranix/shared/api';
import {
  Avatar,
  Badge,
  Button,
  ColorDot,
  FormMessage,
  Sheet,
  Skeleton,
  TextAreaField,
  useToast,
} from '@guaranix/ui';
import { errorText, LoadError, useBoxClock, useNow } from '@guaranix/ui/data';
import { useState } from 'react';
import { useCancelClass, useMarkAttendance } from '../../api/mutations';
import { useRoster } from '../../api/queries';
import { canManage } from '../../lib/roles';
import { AttendanceHint } from './AttendanceHint';
import { attendanceWindow } from './attendance-window';
import { RosterRow } from './RosterRow';
import { WalkInPanel } from './WalkInPanel';

const SPOT_STATUSES = new Set(['booked', 'attended', 'no_show']);

export interface ClassRosterSheetProps {
  item: ClassListItem | null;
  onClose: () => void;
}

export function ClassRosterSheet({ item, onClose }: ClassRosterSheetProps) {
  const { timeZone, today, role, checkInModes } = useBoxClock();
  const now = useNow();
  const roster = useRoster(item?.id ?? null);
  const attendance = useMarkAttendance(item?.id ?? '');
  const cancel = useCancelClass(item?.id ?? '');
  const toast = useToast();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');

  const entries = roster.data?.roster ?? [];
  const spots = entries.filter((entry) => SPOT_STATUSES.has(entry.status));
  const waitlist = entries
    .filter((entry) => entry.status === 'waitlisted')
    .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0));
  const scheduled = item?.status === 'scheduled';
  const timing = attendanceWindow(item, now);
  const listAllowed = canManage(role) || checkInModes?.coach !== false;
  const canMark = scheduled && timing.open && listAllowed;

  const mark = (bookingId: string, status: 'attended' | 'no_show') =>
    attendance.mutate([{ bookingId, status }], {
      onSuccess: () => toast.show(t('admin.classes.attendanceSaved')),
      onError: (error) => toast.show(errorText(error), 'error'),
    });

  const confirmCancel = () =>
    cancel.mutate(reason.trim() || null, {
      onSuccess: () => {
        toast.show(t('admin.classes.cancelled'));
        setCancelling(false);
        onClose();
      },
    });

  const title = item
    ? `${item.programName} · ${formatTimeIn(timeZone, item.startsAt)}`
    : t('admin.classes.roster');

  return (
    <Sheet
      open={item !== null}
      onOpenChange={(open) => !open && onClose()}
      title={title}
      description={
        item ? relativeDayLabel(dateOfInstant(timeZone, item.startsAt), today) : undefined
      }
      closeLabel={t('common.close')}
      footer={
        scheduled && canManage(role) ? (
          cancelling ? (
            <>
              <Button variant="secondary" className="flex-1" onClick={() => setCancelling(false)}>
                {t('common.cancel')}
              </Button>
              <Button className="flex-1" disabled={cancel.isPending} onClick={confirmCancel}>
                {t('admin.classes.confirmCancel')}
              </Button>
            </>
          ) : (
            <Button variant="secondary" className="flex-1" onClick={() => setCancelling(true)}>
              {t('admin.classes.cancelClass')}
            </Button>
          )
        ) : undefined
      }
    >
      {item ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="outline">
              <ColorDot color={item.programColor} />
              {item.programName}
            </Badge>
            <Badge tone={item.spotsLeft === 0 ? 'warning' : 'neutral'}>
              {t('admin.classes.capacity')}{' '}
              {t('admin.classes.bookedCount', { taken: item.takenSpots, capacity: item.capacity })}
            </Badge>
            {scheduled ? null : <Badge tone="neutral">{t('admin.classes.cancelledBadge')}</Badge>}
          </div>
          {item.cancellationReason ? (
            <p className="text-sm text-text-secondary">{item.cancellationReason}</p>
          ) : null}
          {cancelling ? (
            <TextAreaField
              label={t('admin.classes.cancelReason')}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          ) : null}
          {cancel.isError ? (
            <FormMessage tone="error">{errorText(cancel.error)}</FormMessage>
          ) : null}
          {roster.isPending ? (
            <div aria-busy="true" className="flex flex-col gap-2">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-11" />
              ))}
            </div>
          ) : roster.isError ? (
            <LoadError error={roster.error} onRetry={() => void roster.refetch()} />
          ) : (
            <>
              <section className="flex flex-col gap-1">
                <h3 className="font-display text-base font-bold">{t('admin.classes.roster')}</h3>
                {spots.length === 0 ? (
                  <p className="text-sm text-text-secondary">{t('admin.classes.rosterEmpty')}</p>
                ) : (
                  <>
                    <AttendanceHint
                      scheduled={scheduled}
                      open={timing.open}
                      listAllowed={listAllowed}
                    />
                    <ul className="flex flex-col divide-y divide-divider">
                      {spots.map((entry) => (
                        <RosterRow
                          key={entry.bookingId}
                          entry={entry}
                          canMark={canMark}
                          canMarkMissing={timing.started}
                          disabled={attendance.isPending}
                          onMark={(status) => mark(entry.bookingId, status)}
                        />
                      ))}
                    </ul>
                  </>
                )}
              </section>
              {canMark && !timing.ended ? (
                <WalkInPanel
                  classId={item.id}
                  takenIds={new Set(entries.map((entry) => entry.memberId))}
                />
              ) : null}
              {waitlist.length > 0 ? (
                <section className="flex flex-col gap-1">
                  <h3 className="font-display text-base font-bold">
                    {t('admin.classes.waitlistTitle', { count: waitlist.length })}
                  </h3>
                  <ol className="flex flex-col divide-y divide-divider">
                    {waitlist.map((entry) => (
                      <li key={entry.bookingId} className="flex items-center gap-3 py-2.5">
                        <span className="w-6 text-sm text-text-secondary tabular-nums">
                          {entry.waitlistPosition}
                        </span>
                        <Avatar firstName={entry.firstName} lastName={entry.lastName} size="sm" />
                        <span className="truncate font-medium">
                          {entry.firstName} {entry.lastName}
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </Sheet>
  );
}
