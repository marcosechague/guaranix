import { withBoxScope } from '@guaranix/db';
import { MOCK_SIGNATURE_HEADER, signMockWebhook } from '@guaranix/payments';
import { idSchema, paymentLinkTokenSchema, simulatePaymentSchema } from '@guaranix/shared';
import { Hono, type Context } from 'hono';
import type { AppEnv } from '../env';
import { parseBody, parseParam, readRawText, respondWith } from '../lib/service-route';
import {
  findPaymentAccount,
  openPrivateKey,
  paymentRuntimeFor,
} from '../services/card-payment-runtime';
import { notFound, ServiceError } from '../services/errors';
import {
  describePaymentLink,
  latestLinkAttempt,
  startLinkCheckout,
} from '../services/payment-links';
import { processPaymentWebhook } from '../services/payment-webhooks';
import { RATE_LIMITS } from '../services/rate-limit';
import { ipSubject, rateLimited } from './auth-helpers';

const runtimeOf = (context: Context<AppEnv>) =>
  paymentRuntimeFor(context.env, context.var.services);
const tokenOf = (context: Context<AppEnv>) =>
  parseParam(context, 'token', paymentLinkTokenSchema, 'payment_link');

/**
 * Processor confirmations. No session and no Origin (it is a server calling):
 * the signature, checked with the account's own key, is the only proof.
 */
export const paymentWebhookRoutes = new Hono<AppEnv>();

/** Confirmations are a few hundred bytes; anything far bigger is not one. */
const WEBHOOK_MAX_BYTES = 64 * 1024;

paymentWebhookRoutes.post('/:accountId', async (context) => {
  try {
    const response = await processPaymentWebhook(
      context.var.services.database(),
      runtimeOf(context),
      parseParam(context, 'accountId', idSchema, 'payment_account'),
      { body: await readRawText(context, WEBHOOK_MAX_BYTES), headers: context.req.raw.headers },
      new Date(),
    );
    return context.json(response.body, response.status);
  } catch (error) {
    if (error instanceof ServiceError) return context.json({ error: error.code }, error.status);
    throw error;
  }
});

/** The page a payment link opens. Anyone with the link can pay; nobody sees more than the charge. */
export const paymentLinkRoutes = new Hono<AppEnv>();

paymentLinkRoutes.use('*', async (context, next) => {
  const limited = await rateLimited(context, RATE_LIMITS.paymentLinkByIp, ipSubject(context));
  return limited ?? next();
});

paymentLinkRoutes.get('/:token', (context) =>
  respondWith(context, async () => ({
    link: await describePaymentLink(context.var.services.database(), tokenOf(context), new Date()),
  })),
);

paymentLinkRoutes.post('/:token/checkout', (context) =>
  respondWith(context, () =>
    startLinkCheckout(
      context.var.services.database(),
      runtimeOf(context),
      tokenOf(context),
      new Date(),
    ),
  ),
);

// Development only: what the mock processor's form would do, through the real webhook path.
paymentLinkRoutes.post('/:token/simulate', async (context) => {
  // Not even staging: anyone holding a link there could mark a charge paid.
  if (context.env.APP_ENV !== 'development') return context.json({ error: 'not_found' }, 404);
  return respondWith(context, async () => {
    const database = context.var.services.database();
    const runtime = runtimeOf(context);
    const { approved } = await parseBody(context, simulatePaymentSchema);
    const { attempt, boxId } = await latestLinkAttempt(database, tokenOf(context), new Date());
    const account = await withBoxScope(database, { boxId }, (transaction) =>
      findPaymentAccount(transaction, boxId),
    );
    if (!account || account.provider !== 'mock') throw notFound('payment_attempt');
    const signed = await signMockWebhook(await openPrivateKey(runtime, account), {
      orderNumber: attempt.orderNumber,
      approved,
      amountGs: attempt.amountGs,
    });
    const response = await processPaymentWebhook(
      database,
      runtime,
      account.id,
      { body: signed.body, headers: new Headers({ [MOCK_SIGNATURE_HEADER]: signed.signature }) },
      new Date(),
    );
    return { accepted: response.status === 200 };
  });
});
