import type { SchemaDatabase } from '@guaranix/db';
import type { EmailSender } from '@guaranix/messaging';
import type { PaymentProviderFactory } from './services/card-payment-runtime';
import type { PaymentNotifier } from './services/payment-notifier';
import type { AiProviderFactory } from './services/ai-runtime';
import type { NotificationJob, NotificationServices } from './services/notifications/queue';
import type { CaptchaVerifier } from './integrations/captcha';
import type { FileStorage } from './integrations/file-storage';
import type { GoogleOAuth } from './integrations/google-oauth';

export type AppEnvironment = 'development' | 'staging' | 'production';

export interface Bindings {
  APP_ENV: AppEnvironment;
  /** Comma-separated origins of the web apps, e.g. `http://localhost:5173,http://localhost:5174`. */
  ALLOWED_ORIGINS: string;
  /** Public URL of this API, used for the Google redirect URI. */
  PUBLIC_API_URL: string;
  /** Neon through Hyperdrive in Cloudflare. */
  HYPERDRIVE?: Hyperdrive;
  /** Local Postgres, from `.dev.vars`. Ignored when HYPERDRIVE is bound. */
  DATABASE_URL?: string;
  /** Secret (`wrangler secret put`) for the password pepper, CSRF tokens and rate-limit keys. */
  AUTH_SECRET: string;
  /** Private R2 bucket for payment receipts. `wrangler dev` simulates it locally. */
  RECEIPTS: R2Bucket;
  // Integrations below are optional in development (login works without them)
  // and required everywhere else: see `readIntegrationConfig`.
  /** Public key the apps render the Turnstile widget with. */
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  /** Verified Resend sender, e.g. `GuaraniX <no-responder@guaranix.com.py>`. */
  EMAIL_FROM?: string;
  /**
   * 32 random bytes in base64 (`openssl rand -base64 32`, then `wrangler secret
   * put AI_SECRETS_KEY`). Encrypts the AI provider keys stored in the database.
   * Without it AI features stay off; changing it means loading the keys again.
   */
  AI_SECRETS_KEY?: string;
  /**
   * Same format as AI_SECRETS_KEY (`wrangler secret put PAYMENTS_SECRETS_KEY`).
   * Encrypts each box's processor private key. Without it no box can connect
   * card payments; changing it means every box loads its keys again.
   */
  PAYMENTS_SECRETS_KEY?: string;
  /** Public URL of the member app: payment links and the card form return there. */
  MEMBER_APP_URL: string;
  // Notifications (see docs/notificaciones.md). Each channel turns on when its keys exist.
  /** Cloudflare Queue `guaranix-notifications`; jobs wait in Postgres until it is bound. */
  NOTIFICATIONS_QUEUE?: Queue<NotificationJob>;
  /** VAPID pair from `pnpm --filter @guaranix/messaging vapid:generate`. The public half is a var. */
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  /** Contact push services can reach, e.g. `mailto:soporte@guaranix.com.py`. */
  VAPID_SUBJECT?: string;
  /** From @BotFather. */
  TELEGRAM_BOT_TOKEN?: string;
  /** Bot username without `@`, e.g. `GuaranixBot`. A var. */
  TELEGRAM_BOT_USERNAME?: string;
  /** Random string passed to `setWebhook` as `secret_token`; proves calls come from Telegram. */
  TELEGRAM_WEBHOOK_SECRET?: string;
  /** Permanent token of a Meta system user with `whatsapp_business_messaging`. */
  WHATSAPP_ACCESS_TOKEN?: string;
  /** "Phone number ID" of the sending number in WhatsApp Manager. A var. */
  WHATSAPP_PHONE_NUMBER_ID?: string;
  /** Language the templates were approved in; `es` by default. A var. */
  WHATSAPP_TEMPLATE_LANGUAGE?: string;
  /** Admin panel origin, for links in Telegram messages. A var. */
  ADMIN_APP_URL?: string;
}

/** External integrations, swapped for fakes in tests. */
export interface Services {
  database(): SchemaDatabase;
  emailSender: EmailSender;
  /** Payment receipts (R2). */
  files: FileStorage;
  /** Null when captcha is off (development without Turnstile keys). */
  captcha: CaptchaVerifier | null;
  /** Null when Google sign-in is off (development without Google keys). */
  google: GoogleOAuth | null;
  /** Builds the AI provider the superadmin configured; tests pass a mock. */
  aiProviderFactory: AiProviderFactory;
  /** Builds a box's card processor from its decrypted keys; tests pass the mock. */
  paymentProviderFactory: PaymentProviderFactory;
  /** Tells a member an automatic charge failed, with a link to pay. */
  paymentNotifier: PaymentNotifier;
  /** Queue, channels and settings for push, Telegram and WhatsApp. */
  notifications: NotificationServices;
}

export interface AuthenticatedSession {
  id: string;
  token: string;
  userId: string;
  activeBoxId: string | null;
  isPlatformAdmin: boolean;
  /** Set while a platform admin is working inside a box ("entrar como"). */
  impersonation: { boxId: string; endsAt: Date } | null;
}

export interface Variables {
  services: Services;
  session: AuthenticatedSession | null;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: Variables;
}
