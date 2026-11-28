import { bookingPolicySchema, checkInPolicySchema } from '@guaranix/shared';
import { createBoxRouter } from '../../middleware/box-scope';
import { parseBody, respond } from '../../lib/service-route';
import {
  getBookingPolicy,
  getCheckInPolicy,
  updateBookingPolicy,
  updateCheckInPolicy,
} from '../../services/box-settings';
import { MANAGERS, STAFF } from './roles';

const settings = createBoxRouter();

settings.get('/booking', STAFF, (context) =>
  respond(context, async (service) => ({ policy: await getBookingPolicy(service) })),
);

settings.patch('/booking', MANAGERS, (context) =>
  respond(context, async (service) => ({
    policy: await updateBookingPolicy(service, await parseBody(context, bookingPolicySchema)),
  })),
);

settings.get('/check-in', STAFF, (context) =>
  respond(context, async (service) => ({ policy: await getCheckInPolicy(service) })),
);

settings.patch('/check-in', MANAGERS, (context) =>
  respond(context, async (service) => ({
    policy: await updateCheckInPolicy(service, await parseBody(context, checkInPolicySchema)),
  })),
);

export const settingsRoutes = settings.router;
