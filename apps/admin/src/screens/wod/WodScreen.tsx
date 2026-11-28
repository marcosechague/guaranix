import {
  addDays,
  dayOfMonth,
  formatDayMonth,
  startOfWeek,
  t,
  weekdayShort,
} from '@guaranix/shared';
import {
  Button,
  ChipGroup,
  DayPicker,
  EmptyState,
  IconButton,
  Page,
  PageHeader,
  Skeleton,
} from '@guaranix/ui';
import { LoadError, useBoxClock } from '@guaranix/ui/data';
import { ChevronLeft, ChevronRight, Dumbbell } from 'lucide-react';
import { useState } from 'react';
import { usePrograms, useWorkouts } from '../../api/queries';
import { WorkoutEditor } from './WorkoutEditor';

export function WodScreen() {
  const { today } = useBoxClock();
  const [date, setDate] = useState(today);
  const [creating, setCreating] = useState(false);
  const programs = usePrograms();
  const activePrograms = (programs.data ?? []).filter((program) => program.isActive);
  const [chosenProgram, setChosenProgram] = useState<string | null>(null);
  const programId = chosenProgram ?? activePrograms[0]?.id ?? null;
  const workouts = useWorkouts(date);
  const workout = workouts.data?.find((candidate) => candidate.programId === programId);
  const weekStart = startOfWeek(date);
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  const pickDate = (next: string) => {
    setDate(next);
    setCreating(false);
  };

  return (
    <Page layout="panel">
      <PageHeader
        size="large"
        title={t('admin.wod.title')}
        subtitle={t('admin.wod.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            <IconButton
              label={t('admin.classes.previousWeek')}
              onClick={() => pickDate(addDays(date, -7))}
            >
              <ChevronLeft aria-hidden="true" size={20} />
            </IconButton>
            <Button variant="secondary" onClick={() => pickDate(today)}>
              {t('common.today')}
            </Button>
            <IconButton
              label={t('admin.classes.nextWeek')}
              onClick={() => pickDate(addDays(date, 7))}
            >
              <ChevronRight aria-hidden="true" size={20} />
            </IconButton>
          </div>
        }
      />
      <DayPicker
        label={t('admin.wod.dateLabel')}
        value={date}
        onChange={pickDate}
        days={days.map((day) => ({ value: day, weekday: weekdayShort(day), day: dayOfMonth(day) }))}
      />
      {activePrograms.length > 1 && programId ? (
        <ChipGroup
          label={t('admin.wod.program')}
          value={programId}
          onChange={(value) => {
            setChosenProgram(value);
            setCreating(false);
          }}
          options={activePrograms.map((program) => ({ value: program.id, label: program.name }))}
        />
      ) : null}
      {workouts.isPending || programs.isPending ? (
        <div aria-busy="true" className="flex flex-col gap-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : workouts.isError ? (
        <LoadError error={workouts.error} onRetry={() => void workouts.refetch()} />
      ) : !programId ? (
        <EmptyState
          framed
          title={t('admin.wod.noProgram')}
          description={t('admin.wod.emptyBody')}
        />
      ) : workout || creating ? (
        <WorkoutEditor
          key={`${programId}-${date}-${workout?.id ?? 'new'}`}
          workout={workout}
          programId={programId}
          workoutDate={date}
        />
      ) : (
        <EmptyState
          framed
          icon={Dumbbell}
          title={`${t('admin.wod.emptyTitle')} · ${formatDayMonth(date)}`}
          description={t('admin.wod.emptyBody')}
          action={<Button onClick={() => setCreating(true)}>{t('admin.wod.create')}</Button>}
        />
      )}
    </Page>
  );
}
