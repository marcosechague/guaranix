import { addDays, zonedInstant } from '@guaranix/shared';
import { monthRange } from '../../lib/occupancy';

/** The box-local month around `today`, as the instants the payments API filters by. */
export function monthInstants(today: string, timeZone: string) {
  const month = monthRange(today);
  return {
    name: month.name,
    from: zonedInstant(month.from, '00:00', timeZone).toISOString(),
    to: zonedInstant(addDays(month.to, 1), '00:00', timeZone).toISOString(),
  };
}
