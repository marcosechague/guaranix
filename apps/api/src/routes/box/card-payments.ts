import {
  connectPaymentAccountSchema,
  createPaymentLinkSchema,
  listPaymentAttemptsQuerySchema,
  startCardRegistrationSchema,
  updatePaymentAccountSchema,
} from '@guaranix/shared';
import type { Context } from 'hono';
import { idParam, parseBody, parseQuery, respond } from '../../lib/service-route';
import { type BoxEnv, createBoxRouter } from '../../middleware/box-scope';
import { paymentRuntimeFor } from '../../services/card-payment-runtime';
import { listPaymentAttempts, refundCardPayment } from '../../services/card-refunds';
import {
  connectPaymentAccount,
  disconnectPaymentAccount,
  getPaymentSettings,
  updatePaymentAccount,
} from '../../services/payment-accounts';
import { createPaymentLinkForCharge } from '../../services/payment-links';
import {
  confirmOwnCard,
  listMemberCards,
  listOwnCards,
  removeOwnCard,
  startOwnCardRegistration,
} from '../../services/saved-cards';
import { FRONT_DESK, MANAGERS, MEMBERS_ONLY } from './roles';

const OWNER = ['box_owner'] as const;

const runtimeOf = (context: Context<BoxEnv>) =>
  paymentRuntimeFor(context.env, context.var.services);

const cards = createBoxRouter();

// The box's own processor account: the owner decides where the money goes.
cards.get('/settings', MANAGERS, (context) =>
  respond(context, (service) => getPaymentSettings(service, runtimeOf(context))),
);

cards.put('/account', OWNER, (context) =>
  respond(context, async (service) => ({
    account: await connectPaymentAccount(
      service,
      runtimeOf(context),
      await parseBody(context, connectPaymentAccountSchema),
    ),
  })),
);

cards.patch('/account', MANAGERS, (context) =>
  respond(context, async (service) => ({
    account: await updatePaymentAccount(
      service,
      runtimeOf(context),
      await parseBody(context, updatePaymentAccountSchema),
    ),
  })),
);

cards.delete('/account', OWNER, (context) =>
  respond(context, async (service) => ({
    account: await disconnectPaymentAccount(service, runtimeOf(context)),
  })),
);

cards.get('/attempts', FRONT_DESK, (context) =>
  respond(context, async (service) => ({
    attempts: await listPaymentAttempts(
      service,
      parseQuery(context, listPaymentAttemptsQuerySchema),
    ),
  })),
);

cards.post('/links', FRONT_DESK, (context) =>
  respond(
    context,
    async (service) => {
      const { chargeId } = await parseBody(context, createPaymentLinkSchema);
      return { link: await createPaymentLinkForCharge(service, runtimeOf(context), chargeId) };
    },
    201,
  ),
);

cards.post('/payments/:paymentId/refund', MANAGERS, (context) =>
  respond(context, async (service) => ({
    payment: await refundCardPayment(
      service,
      runtimeOf(context),
      idParam(context, 'paymentId', 'payment'),
    ),
  })),
);

cards.get('/members/:memberId/cards', FRONT_DESK, (context) =>
  respond(context, async (service) => ({
    cards: await listMemberCards(service, idParam(context, 'memberId', 'member')),
  })),
);

// The member's own card. They type it on the processor's form, never ours.
cards.get('/me/cards', MEMBERS_ONLY, (context) =>
  respond(context, (service) => listOwnCards(service, runtimeOf(context))),
);

cards.post('/me/cards', MEMBERS_ONLY, (context) =>
  respond(
    context,
    async (service) => {
      await parseBody(context, startCardRegistrationSchema);
      return startOwnCardRegistration(service, runtimeOf(context));
    },
    201,
  ),
);

cards.post('/me/cards/:cardId/confirm', MEMBERS_ONLY, (context) =>
  respond(context, async (service) => ({
    card: await confirmOwnCard(
      service,
      runtimeOf(context),
      idParam(context, 'cardId', 'saved_card'),
    ),
  })),
);

cards.delete('/me/cards/:cardId', MEMBERS_ONLY, (context) =>
  respond(context, async (service) => {
    await removeOwnCard(service, runtimeOf(context), idParam(context, 'cardId', 'saved_card'));
    return { removed: true };
  }),
);

export const cardPaymentRoutes = cards.router;
