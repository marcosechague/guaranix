// Push, Telegram, WhatsApp and email behind a common interface. Email is first:
// it carries password reset links. The other channels come with their providers.
export type { EmailMessage, EmailSender } from './email/email-sender';
export { createConsoleEmailSender } from './email/console-email-sender';
export { createMemoryEmailSender } from './email/memory-email-sender';
export { createResendEmailSender } from './email/resend-email-sender';
export type { ResendOptions } from './email/resend-email-sender';
