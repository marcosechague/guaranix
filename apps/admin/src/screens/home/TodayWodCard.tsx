import { t } from '@guaranix/shared';
import { Badge, Button, Card, Skeleton } from '@guaranix/ui';
import { useBoxClock } from '@guaranix/ui/data';
import { Link } from 'react-router';
import { usePrograms, useWorkouts } from '../../api/queries';

export function TodayWodCard() {
  const { today } = useBoxClock();
  const workouts = useWorkouts(today);
  const programs = usePrograms();
  const workout = workouts.data?.[0];
  const published = Boolean(workout?.publishedAt);
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">{t('admin.home.wodTitle')}</h2>
        {workout ? (
          <Badge tone={published ? 'success' : 'warning'} dot>
            {published ? t('admin.wod.published') : t('admin.wod.draft')}
          </Badge>
        ) : null}
      </div>
      {workouts.isPending ? (
        <Skeleton className="h-16" />
      ) : workout ? (
        <div className="flex flex-col gap-1">
          <p className="font-display text-xl font-bold">{workout.title}</p>
          <p className="text-sm text-text-secondary">
            {programs.data?.find((program) => program.id === workout.programId)?.name} ·{' '}
            {t('admin.wod.partsCount', { count: workout.components.length })}
          </p>
          <p className="text-sm text-text-secondary">
            {published ? t('admin.home.wodPublished') : t('admin.home.wodDraft')}
          </p>
        </div>
      ) : (
        <p className="text-sm text-text-secondary">{t('admin.home.wodMissing')}</p>
      )}
      <Button asChild variant={workout ? 'secondary' : 'primary'}>
        <Link to="/wod">{workout ? t('admin.home.openWod') : t('admin.home.programWod')}</Link>
      </Button>
    </Card>
  );
}
