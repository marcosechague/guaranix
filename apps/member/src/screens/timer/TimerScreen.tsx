import { t, timerPlanFor } from '@guaranix/shared';
import { Button, EmptyState, Page, Skeleton } from '@guaranix/ui';
import { useBoxClock } from '@guaranix/ui/data';
import { Link, useParams } from 'react-router';
import { useWorkouts } from '../../api/queries';
import { TimerRunner } from './TimerRunner';

function TimerSkeleton() {
  return (
    <div data-theme="dark" className="min-h-dvh bg-background">
      <Page layout="centered" className="items-center">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-32 w-64 rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </Page>
    </div>
  );
}

/** Opened from the WOD of the day; reads the part from the cached WOD so it also opens offline. */
export function TimerScreen() {
  const { componentId } = useParams();
  const { today } = useBoxClock();
  const workouts = useWorkouts(today);
  const component = workouts.data
    ?.flatMap((workout) => workout.components)
    .find((item) => item.id === componentId);
  const plan = component ? timerPlanFor(component) : null;

  if (workouts.isPending) return <TimerSkeleton />;
  if (!component || !plan) {
    return (
      <Page layout="centered">
        <EmptyState
          framed
          title={t('member.timer.notFoundTitle')}
          description={t('member.timer.notFoundBody')}
          action={
            <Button asChild>
              <Link to="/wod">{t('member.timer.backToWod')}</Link>
            </Button>
          }
        />
      </Page>
    );
  }
  return <TimerRunner key={component.id} component={component} plan={plan} />;
}
