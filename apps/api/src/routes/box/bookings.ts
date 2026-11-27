import { bookClassSchema, cancelBookingSchema } from '@guaranix/shared';
import { createBoxRouter } from '../../middleware/box-scope';
import { idParam, parseBody, respond } from '../../lib/service-route';
import { bookClass, cancelBooking, listOwnBookings } from '../../services/bookings';
import { listMemberPlans } from '../../services/member-plans';
import { getOwnMember } from '../../services/members';
import { ANY_ROLE, MEMBERS_ONLY } from './roles';

const bookings = createBoxRouter();

bookings.post('/', ANY_ROLE, (context) =>
  respond(
    context,
    async (service) => ({
      booking: await bookClass(service, await parseBody(context, bookClassSchema)),
    }),
    201,
  ),
);

bookings.post('/:bookingId/cancel', ANY_ROLE, (context) =>
  respond(context, async (service) => {
    const bookingId = idParam(context, 'bookingId', 'booking');
    const { forgiveLateCancel } = await parseBody(context, cancelBookingSchema);
    return cancelBooking(service, bookingId, { forgiveLateCancel });
  }),
);

export const bookingRoutes = bookings.router;

/** The member app's own data: profile, plans and upcoming bookings. */
const me = createBoxRouter();

me.get('/', MEMBERS_ONLY, (context) =>
  respond(context, async (service) => ({ member: await getOwnMember(service) })),
);

me.get('/plans', MEMBERS_ONLY, (context) =>
  respond(context, async (service) => ({
    plans: await listMemberPlans(service, (await getOwnMember(service)).id),
  })),
);

me.get('/bookings', MEMBERS_ONLY, (context) =>
  respond(context, async (service) => ({
    bookings: await listOwnBookings(service, service.now),
  })),
);

export const meRoutes = me.router;
