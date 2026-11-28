import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { telegramUpdateSchema } from '@guaranix/shared';
import { constantTimeEqual } from '../lib/crypto';
import { parseBody } from '../lib/service-route';
import { handleTelegramUpdate } from '../services/notifications/telegram-webhook';

/** Called by Telegram, not a browser; listed in `WEBHOOK_ROUTES` (auth gate). */
export const telegramWebhookRoutes = new Hono<AppEnv>();

telegramWebhookRoutes.post('/webhook', async (context) => {
  const { config, channels } = context.var.services.notifications;
  const received = context.req.header('x-telegram-bot-api-secret-token') ?? '';
  // Without a configured secret nobody can call it: fail closed.
  if (!config.telegramWebhookSecret || !constantTimeEqual(received, config.telegramWebhookSecret)) {
    return context.json({ error: 'forbidden' }, 403);
  }
  let update: unknown;
  try {
    update = await parseBody(context, telegramUpdateSchema);
  } catch {
    // Answer 200 anyway: Telegram retries anything else for hours.
    return context.json({ ok: true });
  }
  await handleTelegramUpdate(context.var.services.database(), channels, update, new Date());
  return context.json({ ok: true });
});
