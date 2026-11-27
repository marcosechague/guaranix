import type { EmailMessage, EmailSender } from './email-sender';

/** Keeps sent emails in memory, for tests. */
export function createMemoryEmailSender(): EmailSender & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];
  return {
    sent,
    async send(message: EmailMessage) {
      sent.push(message);
    },
  };
}
