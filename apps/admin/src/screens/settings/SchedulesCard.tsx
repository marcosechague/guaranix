import { t, weekdayName } from '@guaranix/shared';
import type { ClassSchedule, Program } from '@guaranix/shared/api';
import { Card, ColorDot, IconButton, Skeleton } from '@guaranix/ui';
import { LoadError, useBoxClock } from '@guaranix/ui/data';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { usePrograms, useSchedules } from '../../api/queries';
import { ScheduleCapacitySheet } from './ScheduleCapacitySheet';

// Monday first, like the box's week.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function SchedulesCard({ editable }: { editable: boolean }) {
  const { today } = useBoxClock();
  const schedules = useSchedules();
  const programs = usePrograms();
  const [editing, setEditing] = useState<ClassSchedule | null>(null);
  const programById = new Map((programs.data ?? []).map((program) => [program.id, program]));
  const current = (schedules.data ?? []).filter(
    (schedule) => schedule.validUntil === null || schedule.validUntil >= today,
  );
  const describe = (schedule: ClassSchedule, program: Program | undefined) =>
    `${weekdayName(schedule.weekday)} ${schedule.startTime} · ${program?.name ?? ''}`;

  return (
    <Card as="section">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold">{t('admin.settings.schedulesTitle')}</h2>
        <p className="text-sm text-text-secondary">{t('admin.settings.schedulesHint')}</p>
      </div>
      {schedules.isPending ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-12" />
          ))}
        </div>
      ) : schedules.isError ? (
        <LoadError error={schedules.error} onRetry={() => void schedules.refetch()} />
      ) : current.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('admin.settings.noSchedules')}</p>
      ) : (
        <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
          {WEEK_ORDER.map((weekday) => {
            const slots = current
              .filter((schedule) => schedule.weekday === weekday)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));
            if (slots.length === 0) return null;
            return (
              <section key={weekday} className="flex flex-col">
                <h3 className="text-xs font-semibold tracking-widest text-text-secondary uppercase">
                  {weekdayName(weekday)}
                </h3>
                <ul className="flex flex-col divide-y divide-divider">
                  {slots.map((schedule) => {
                    const program = programById.get(schedule.programId);
                    return (
                      <li key={schedule.id} className="flex items-center gap-3 py-2">
                        <span className="w-12 font-display font-bold tabular-nums">
                          {schedule.startTime}
                        </span>
                        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                          <ColorDot color={program?.color ?? null} />
                          <span className="truncate">{program?.name}</span>
                          <span className="text-text-secondary">
                            {t('admin.settings.durationMinutes', {
                              count: schedule.durationMinutes,
                            })}
                          </span>
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {t('admin.settings.spots', { count: schedule.capacity })}
                        </span>
                        {editable ? (
                          <IconButton
                            variant="ghost"
                            label={`${t('admin.settings.editCapacity')}: ${describe(schedule, program)}`}
                            onClick={() => setEditing(schedule)}
                          >
                            <Pencil aria-hidden="true" size={17} />
                          </IconButton>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      {editing ? (
        <ScheduleCapacitySheet
          schedule={editing}
          title={describe(editing, programById.get(editing.programId))}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Card>
  );
}
