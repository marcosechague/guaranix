import {
  chargeSchema,
  dashboardQuerySchema,
  listChargesQuerySchema,
  listPaymentsQuerySchema,
  recordPaymentSchema,
  reviewPaymentSchema,
} from '@guaranix/shared';
import { createBoxRouter } from '../../middleware/box-scope';
import { idParam, parseBody, parseQuery, respond } from '../../lib/service-route';
import { createCharge, listCharges, listDebtors, voidCharge } from '../../services/charges';
import { dashboard } from '../../services/dashboard';
import { listPayments, recordPayment, reviewPayment } from '../../services/payments';
import { ANY_ROLE, FRONT_DESK, MANAGERS } from './roles';

const chargeRouter = createBoxRouter();

chargeRouter.get('/', FRONT_DESK, (context) =>
  respond(context, async (service) => ({
    charges: await listCharges(service, parseQuery(context, listChargesQuerySchema)),
  })),
);

chargeRouter.post('/', FRONT_DESK, (context) =>
  respond(
    context,
    async (service) => ({
      charge: await createCharge(service, await parseBody(context, chargeSchema)),
    }),
    201,
  ),
);

chargeRouter.post('/:chargeId/void', MANAGERS, (context) =>
  respond(context, async (service) => ({
    charge: await voidCharge(service, idParam(context, 'chargeId', 'charge')),
  })),
);

export const chargeRoutes = chargeRouter.router;

const paymentRouter = createBoxRouter();

paymentRouter.get('/', FRONT_DESK, (context) =>
  respond(context, async (service) => ({
    payments: await listPayments(service, parseQuery(context, listPaymentsQuerySchema)),
  })),
);

// Members report transfers or QR with a receipt; the service decides what each role may do.
paymentRouter.post('/', ANY_ROLE, (context) =>
  respond(
    context,
    async (service) => ({
      payment: await recordPayment(service, await parseBody(context, recordPaymentSchema)),
    }),
    201,
  ),
);

paymentRouter.post('/:paymentId/review', FRONT_DESK, (context) =>
  respond(context, async (service) => {
    const paymentId = idParam(context, 'paymentId', 'payment');
    const { status } = await parseBody(context, reviewPaymentSchema, { paymentId });
    return { payment: await reviewPayment(service, paymentId, status) };
  }),
);

export const paymentRoutes = paymentRouter.router;

const reports = createBoxRouter();

reports.get('/debtors', FRONT_DESK, (context) =>
  respond(context, async (service) => ({ debtors: await listDebtors(service) })),
);

reports.get('/dashboard', MANAGERS, (context) =>
  respond(context, async (service) =>
    dashboard(service, parseQuery(context, dashboardQuerySchema)),
  ),
);

export const reportRoutes = reports.router;
