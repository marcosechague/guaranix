import type { WorkoutComponent } from '@guaranix/shared/api';
import { Badge, Button, Card } from '@guaranix/ui';
import { Timer } from 'lucide-react';
import { Link } from 'react-router';
import { t, timerPlanFor } from '@guaranix/shared';
import { timerChips } from '../../lib/workout-summary';

export function ComponentCard({ component }: { component: WorkoutComponent }) {
  const chips = timerChips(component);
  return (
    <Card as="article" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-widest text-accent-text uppercase">
          {t(`workout.kinds.${component.kind}`)}
        </span>
        {chips.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <Badge key={chip} tone="outline">
                {chip}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      {component.title ? (
        <h2 className="font-display text-xl font-bold">{component.title}</h2>
      ) : null}
      <p className="leading-relaxed whitespace-pre-line text-text-soft">{component.description}</p>
      {timerPlanFor(component) ? (
        <Button asChild variant="secondary" className="self-start">
          <Link to={`/wod/timer/${component.id}`}>
            <Timer aria-hidden="true" size={18} />
            {t('member.timer.open')}
          </Link>
        </Button>
      ) : null}
    </Card>
  );
}
