import { fileKeySchema, RECEIPT_MAX_BYTES } from '@guaranix/shared';
import { createBoxRouter } from '../../middleware/box-scope';
import { parseParam, readUpload, respond, serviceContext } from '../../lib/service-route';
import { ServiceError } from '../../services/errors';
import { readReceipt, storeReceipt } from '../../services/receipts';
import { ANY_ROLE } from './roles';

const receipts = createBoxRouter();

// The file is the raw request body (`Content-Type: image/jpeg`, …); the service checks its bytes.
receipts.post('/', ANY_ROLE, (context) =>
  respond(
    context,
    async (service) =>
      storeReceipt(
        service,
        context.var.services.files,
        await readUpload(context, RECEIPT_MAX_BYTES, 'receipt_too_large'),
      ),
    201,
  ),
);

receipts.get('/:key{.+}', ANY_ROLE, async (context) => {
  try {
    const key = parseParam(context, 'key', fileKeySchema, 'receipt');
    const file = await readReceipt(serviceContext(context), context.var.services.files, key);
    return context.body(file.body, 200, {
      'content-type': file.contentType,
      'content-disposition': 'inline',
      'cache-control': 'private, max-age=300',
      // Receipts are user files: never let the browser run them as a page.
      'content-security-policy': "default-src 'none'; sandbox",
      'x-content-type-options': 'nosniff',
    });
  } catch (error) {
    if (error instanceof ServiceError) return context.json({ error: error.code }, error.status);
    throw error;
  }
});

export const receiptRoutes = receipts.router;
