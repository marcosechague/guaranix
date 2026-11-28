import { formatDuration, t } from '@guaranix/shared';
import type { WorkoutComponent } from '@guaranix/shared/api';

/** Short labels for a component's timer ("For time", "Cap 15:00", "EMOM 10 × 1:00"). */
export function timerChips(component: WorkoutComponent): string[] {
  switch (component.timerType) {
    case 'for_time':
      return [
        t('workout.timers.for_time'),
        ...(component.timeCapSeconds
          ? [t('workout.cap', { time: formatDuration(component.timeCapSeconds) })]
          : []),
      ];
    case 'amrap':
      return [t('workout.amrapFor', { time: formatDuration(component.timeCapSeconds ?? 0) })];
    case 'emom':
      return [
        t('workout.emomFor', {
          rounds: component.rounds ?? 0,
          interval: formatDuration(component.intervalSeconds ?? 0),
        }),
      ];
    case 'tabata':
      return [
        t('workout.tabataFor', {
          rounds: component.rounds ?? 0,
          work: component.workSeconds ?? 0,
          rest: component.restSeconds ?? 0,
        }),
      ];
    case 'none':
      return [];
  }
}

/** The part members score: the metcon if there is one, else the first scored part. */
export function mainScoredComponent(components: readonly WorkoutComponent[]) {
  const scored = components.filter((component) => component.scoreType !== 'none');
  return scored.find((component) => component.kind === 'metcon') ?? scored[0];
}
