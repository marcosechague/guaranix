import { checkInSchema, staffArrivalsQuerySchema } from '@guaranix/shared';
import { createBoxRouter } from '../../middleware/box-scope';
import { parseBody, parseQuery, respond } from '../../lib/service-route';
import { checkInWithPass } from '../../services/check-ins';
import { issueOwnStaffPass, listStaffArrivals } from '../../services/staff-arrivals';
import { MANAGERS, STAFF } from './roles';

/**
 * The entrance device (signed in as staff) sends each QR it reads here:
 * a member's entry or, with the staff mode on, a coach or receptionist arriving.
 */
const checkIns = createBoxRouter();

checkIns.post('/', STAFF, (context) =>
  respond(context, async (service) => {
    const { pass } = await parseBody(context, checkInSchema);
    return { result: await checkInWithPass(service, context.env.AUTH_SECRET, pass) };
  }),
);

checkIns.get('/staff-pass', STAFF, (context) =>
  respond(context, async (service) => ({
    pass: await issueOwnStaffPass(service, context.env.AUTH_SECRET),
  })),
);

checkIns.get('/staff-arrivals', MANAGERS, (context) =>
  respond(context, async (service) => {
    const { date } = parseQuery(context, staffArrivalsQuerySchema);
    return { arrivals: await listStaffArrivals(service, date) };
  }),
);

export const checkInRoutes = checkIns.router;
