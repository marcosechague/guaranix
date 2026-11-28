import { checkInSchema } from '@guaranix/shared';
import { createBoxRouter } from '../../middleware/box-scope';
import { parseBody, respond } from '../../lib/service-route';
import { checkInWithPass } from '../../services/check-ins';
import { STAFF } from './roles';

/** The entrance device (signed in as staff) sends each QR it reads here. */
const checkIns = createBoxRouter();

checkIns.post('/', STAFF, (context) =>
  respond(context, async (service) => {
    const { pass } = await parseBody(context, checkInSchema);
    return { result: await checkInWithPass(service, context.env.AUTH_SECRET, pass) };
  }),
);

export const checkInRoutes = checkIns.router;
