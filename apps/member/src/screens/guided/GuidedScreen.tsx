import { guidedPlanFor, t, timerPlanFor } from '@guaranix/shared';
import { Button, EmptyState, Page, Skeleton } from '@guaranix/ui';
import { Link } from 'react-router';
import { useTodayComponent } from '../timer/use-today-component';
import { GuidedRunner } from './GuidedRunner';

function GuidedSkeleton() {
  return (
    <div data-theme="dark" className="min-h-dvh bg-background">
      <Page layout="mobile">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </Page>
    </div>
  );
}

/** Opened from the WOD of the day; reads the part from the cached WOD so it also opens offline. */
export function GuidedScreen() {
  const { isPending, component } = useTodayComponent();
  const timer = component ? timerPlanFor(component) : null;
  const plan = component ? guidedPlanFor(component, timer) : null;

  if (isPending) return <GuidedSkeleton />;
  if (!component || !timer || !plan) {
    return (
      <Page layout="centered">
        <EmptyState
          framed
          title={t('member.guided.notFoundTitle')}
          description={t('member.guided.notFoundBody')}
          action={
            <Button asChild>
              <Link to="/wod">{t('member.timer.backToWod')}</Link>
            </Button>
          }
        />
      </Page>
    );
  }
  return <GuidedRunner key={component.id} component={component} timer={timer} plan={plan} />;
}
