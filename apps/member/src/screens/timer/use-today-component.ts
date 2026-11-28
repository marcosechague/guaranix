import { useBoxClock } from '@guaranix/ui/data';
import { useParams } from 'react-router';
import { useWorkouts } from '../../api/queries';

/** The WOD part in the URL, read from today's cached WOD so it also opens offline. */
export function useTodayComponent() {
  const { componentId } = useParams();
  const { today } = useBoxClock();
  const workouts = useWorkouts(today);
  const component = workouts.data
    ?.flatMap((workout) => workout.components)
    .find((item) => item.id === componentId);
  return { isPending: workouts.isPending, component };
}
