import { boxPaymentDetailsSchema, PAYMENT_QR_MAX_BYTES } from '@guaranix/shared';
import { createBoxRouter } from '../../middleware/box-scope';
import { parseBody, readUpload, respond, serviceContext } from '../../lib/service-route';
import { ServiceError } from '../../services/errors';
import {
  getPaymentDetails,
  readPaymentQr,
  removePaymentQr,
  storePaymentQr,
  updatePaymentDetails,
} from '../../services/payment-details';
import { ANY_ROLE, MANAGERS } from './roles';

const paymentDetails = createBoxRouter();

paymentDetails.get('/', ANY_ROLE, (context) =>
  respond(context, async (service) => ({ details: await getPaymentDetails(service) })),
);

paymentDetails.patch('/', MANAGERS, (context) =>
  respond(context, async (service) => ({
    details: await updatePaymentDetails(service, await parseBody(context, boxPaymentDetailsSchema)),
  })),
);

// The image is the raw request body; the service checks its bytes.
paymentDetails.post('/qr', MANAGERS, (context) =>
  respond(context, async (service) => ({
    details: await storePaymentQr(
      service,
      context.var.services.files,
      await readUpload(context, PAYMENT_QR_MAX_BYTES, 'payment_qr_too_large'),
    ),
  })),
);

paymentDetails.delete('/qr', MANAGERS, (context) =>
  respond(context, async (service) => ({ details: await removePaymentQr(service) })),
);

paymentDetails.get('/qr', ANY_ROLE, async (context) => {
  try {
    const file = await readPaymentQr(serviceContext(context), context.var.services.files);
    return context.body(file.body, 200, {
      'content-type': file.contentType,
      'content-disposition': 'inline',
      'cache-control': 'private, max-age=300',
      'content-security-policy': "default-src 'none'; sandbox",
      'x-content-type-options': 'nosniff',
    });
  } catch (error) {
    if (error instanceof ServiceError) return context.json({ error: error.code }, error.status);
    throw error;
  }
});

export const paymentDetailsRoutes = paymentDetails.router;
