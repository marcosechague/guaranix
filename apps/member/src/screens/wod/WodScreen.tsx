import { formatDayMonth, t, weekdayLong } from '@guaranix/shared';
import { Button, ChipGroup, EmptyState, Skeleton } from '@guaranix/ui';
import { useState } from 'react';
import { Link } from 'react-router';
import { useLeaderboard, useMe, usePrograms, useWorkouts } from '../../api/queries';
import { LoadError } from '../../layout/LoadError';
import { ScreenHeader } from '../../layout/ScreenHeader';
import { useBoxClock } from '../../lib/use-box-clock';
import { mainScoredComponent } from '../../lib/workout-summary';
import { ComponentCard } from './ComponentCard';
import { ResultCard } from './ResultCard';
import { Whiteboard } from './Whiteboard';

function WodSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4 px-5 pt-7">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

export function WodScreen() {
  const { today } = useBoxClock();
  const workouts = useWorkouts(today);
  const programs = usePrograms();
  const { data: me } = useMe();
  const [programId, setProgramId] = useState<string | null>(null);
  const [componentId, setComponentId] = useState<string | null>(null);

  const list = workouts.data ?? [];
  const workout = list.find((item) => item.programId === programId) ?? list[0];
  const scored = (workout?.components ?? []).filter((component) => component.scoreType !== 'none');
  const selected =
    scored.find((component) => component.id === componentId) ??
    (workout ? mainScoredComponent(workout.components) : undefined);
  const board = useLeaderboard(selected?.id);

  if (workouts.isPending) return <WodSkeleton />;
  if (workouts.isError) {
    return (
      <main className="px-5 pt-7">
        <LoadError error={workouts.error} onRetry={() => void workouts.refetch()} />
      </main>
    );
  }
  if (!workout) {
    return (
      <main>
        <ScreenHeader
          title={t('member.wod.title')}
          eyebrow={`${weekdayLong(today)} ${formatDayMonth(today)}`}
        />
        <div className="px-5">
          <EmptyState
            className="rounded-xl border border-border bg-surface p-5"
            title={t('member.wod.emptyTitle')}
            description={t('member.wod.emptyBody')}
            action={
              <Button asChild>
                <Link to="/reservar">{t('member.home.bookClass')}</Link>
              </Button>
            }
          />
        </div>
      </main>
    );
  }

  const programName = programs.data?.find((program) => program.id === workout.programId)?.name;
  const headline = mainScoredComponent(workout.components);
  const ownEntry = board.data?.entries.find((entry) => entry.memberId === me?.id);
  return (
    <main className="flex flex-col">
      <ScreenHeader
        eyebrow={t('member.wod.dateProgram', {
          date: `${weekdayLong(today)} ${formatDayMonth(today).split(' ')[0]}`,
          program: programName ?? '',
        })}
        title={workout.title ?? headline?.title ?? t('member.wod.title')}
      />
      <div className="flex flex-col gap-4 px-5 pb-6">
        {list.length > 1 ? (
          <ChipGroup
            label={t('member.book.programs')}
            value={workout.programId}
            onChange={(value) => {
              setProgramId(value);
              setComponentId(null);
            }}
            options={list.map((item) => ({
              value: item.programId,
              label: programs.data?.find((program) => program.id === item.programId)?.name ?? '',
            }))}
          />
        ) : null}
        {workout.components.map((component) => (
          <ComponentCard key={component.id} component={component} />
        ))}
        {selected ? (
          <>
            {scored.length > 1 ? (
              <ChipGroup
                label={t('member.wod.whichPart')}
                value={selected.id}
                onChange={setComponentId}
                options={scored.map((component) => ({
                  value: component.id,
                  label: component.title ?? t(`workout.kinds.${component.kind}`),
                }))}
              />
            ) : null}
            {board.isPending ? (
              <Skeleton className="h-56 rounded-xl" />
            ) : (
              <ResultCard key={selected.id} component={selected} ownEntry={ownEntry} />
            )}
            <Whiteboard
              componentId={selected.id}
              board={board.data}
              isPending={board.isPending}
              ownMemberId={me?.id}
            />
          </>
        ) : null}
      </div>
    </main>
  );
}
