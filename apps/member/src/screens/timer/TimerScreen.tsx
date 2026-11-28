import { t, timerPlanFor } from '@guaranix/shared';
import { Button, EmptyState, Page, Skeleton } from '@guaranix/ui';
import { Link } from 'react-router';
import { useTodayComponent } from './use-today-component';
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
  const { isPending, component } = useTodayComponent();
  const plan = component ? timerPlanFor(component) : null;

  if (isPending) return <TimerSkeleton />;
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
