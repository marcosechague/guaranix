import {
  notificationPreferenceInputSchema,
  pushSubscriptionInputSchema,
  pushUnsubscribeInputSchema,
} from '@guaranix/shared';
import { parseBody, respondWith } from '../lib/service-route';
import { createAccountRouter } from '../middleware/account-scope';
import {
  getNotificationSettings,
  removePushSubscription,
  savePushSubscription,
  setNotificationPreference,
  startTelegramLink,
  unlinkTelegram,
} from '../services/notifications/settings';

/**
 * A person's own notification settings. They follow the person across boxes,
 * so they live outside box scope; every service filters by the session's user.
 */
const notifications = createAccountRouter();

notifications.get('/settings', (context) =>
  respondWith(context, () =>
    getNotificationSettings(
      context.var.transaction,
      context.var.session.userId,
      context.var.services.notifications.config,
    ),
  ),
);

notifications.put('/preferences', (context) =>
  respondWith(context, async () => ({
    preference: await setNotificationPreference(
      context.var.transaction,
      context.var.session.userId,
      await parseBody(context, notificationPreferenceInputSchema),
    ),
  })),
);

notifications.post('/push-subscriptions', (context) =>
  respondWith(
    context,
    async () => {
      await savePushSubscription(
        context.var.transaction,
        context.var.session.userId,
        await parseBody(context, pushSubscriptionInputSchema),
      );
      return { subscribed: true };
    },
    201,
  ),
);

/** POST with the endpoint in the body: it is a long URL, not a path segment. */
notifications.post('/push-subscriptions/remove', (context) =>
  respondWith(context, async () => {
    const { endpoint } = await parseBody(context, pushUnsubscribeInputSchema);
    await removePushSubscription(context.var.transaction, context.var.session.userId, endpoint);
    return { subscribed: false };
  }),
);

notifications.post('/telegram/link', (context) =>
  respondWith(
    context,
    () =>
      startTelegramLink(
        context.var.transaction,
        context.var.session.userId,
        context.var.services.notifications.config,
        new Date(),
      ),
    201,
  ),
);

notifications.delete('/telegram/link', (context) =>
  respondWith(context, async () => {
    await unlinkTelegram(context.var.transaction, context.var.session.userId);
    return { linked: false };
  }),
);

export const notificationRoutes = notifications.router;
