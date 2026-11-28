import { bookClassSchema, cancelBookingSchema, wallCheckInSchema } from '@guaranix/shared';
import { createBoxRouter } from '../../middleware/box-scope';
import { idParam, parseBody, respond } from '../../lib/service-route';
import { bookClass, cancelBooking, listOwnBookings } from '../../services/bookings';
import { listMemberPlans } from '../../services/member-plans';
import { ownAccount } from '../../services/charges';
import { issueOwnCheckInPass } from '../../services/check-ins';
import { getOwnMember, viewOwnMember } from '../../services/members';
import { listOwnPersonalRecords } from '../../services/workout-results';
import { checkInAtWall } from '../../services/wall-check-ins';
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
  respond(context, async (service) => ({ member: await viewOwnMember(service) })),
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

me.get('/records', MEMBERS_ONLY, (context) =>
  respond(context, async (service) => ({ records: await listOwnPersonalRecords(service) })),
);

me.get('/account', MEMBERS_ONLY, (context) =>
  respond(context, async (service) => ownAccount(service)),
);

/** The QR the member shows at the entrance. Short-lived, so the app asks again before it expires. */
me.get('/check-in-pass', MEMBERS_ONLY, (context) =>
  respond(context, async (service) => ({
    pass: await issueOwnCheckInPass(service, context.env.AUTH_SECRET),
  })),
);

/** The member read the poster on the wall; the phone's position says they're really there. */
me.post('/wall-check-ins', MEMBERS_ONLY, (context) =>
  respond(context, async (service) => ({
    result: await checkInAtWall(
      service,
      context.env.AUTH_SECRET,
      await parseBody(context, wallCheckInSchema),
    ),
  })),
);

export const meRoutes = me.router;
