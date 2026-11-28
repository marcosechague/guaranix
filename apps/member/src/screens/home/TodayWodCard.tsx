import { t } from '@guaranix/shared';
import { Badge, Card, EmptyState, Eyebrow, Skeleton } from '@guaranix/ui';
import { ChevronRight, Hourglass } from 'lucide-react';
import { Link } from 'react-router';
import { useWorkouts } from '../../api/queries';
import { useBoxClock } from '../../lib/use-box-clock';
import { mainScoredComponent, timerChips } from '../../lib/workout-summary';

export function TodayWodCard() {
  const { today } = useBoxClock();
  const { data, isPending } = useWorkouts(today);
  const workout = data?.[0];

  if (isPending) {
    return (
      <Card aria-busy="true" className="flex flex-col gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-12" />
      </Card>
    );
  }
  if (!workout) {
    return (
      <Card className="flex flex-col gap-4">
        <Eyebrow>{t('member.home.todayWod')}</Eyebrow>
        <EmptyState
          icon={Hourglass}
          title={t('member.home.wodPendingTitle')}
          description={t('member.home.wodPending')}
        />
      </Card>
    );
  }

  const main = mainScoredComponent(workout.components) ?? workout.components[0];
  const lines = (main?.description ?? '').split('\n').filter(Boolean).slice(0, 3);
  return (
    <Link
      to="/wod"
      className="group block rounded-xl transition-transform duration-fast ease-out active:scale-99"
    >
      <Card as="article" className="flex flex-col gap-3 group-hover:border-text-secondary">
        <div className="flex items-center justify-between">
          <Eyebrow>{t('member.home.todayWod')}</Eyebrow>
          <ChevronRight aria-hidden="true" size={20} className="text-text-secondary" />
        </div>
        <h3 className="font-display text-2xl font-bold">{workout.title ?? main?.title}</h3>
        {main ? (
          <div className="flex flex-wrap gap-2">
            {timerChips(main).map((chip) => (
              <Badge key={chip} tone="neutral">
                {chip}
              </Badge>
            ))}
          </div>
        ) : null}
        <p className="whitespace-pre-line text-text-soft">{lines.join('\n')}</p>
      </Card>
    </Link>
  );
}
