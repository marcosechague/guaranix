import type { EmailMessage, EmailSender } from './email-sender';

export interface ResendOptions {
  apiKey: string;
  /** Verified sender, e.g. `GuaraniX <no-responder@guaranix.com.py>`. */
  from: string;
  fetch?: typeof fetch;
}

const RESEND_URL = 'https://api.resend.com/emails';

export function createResendEmailSender({
  apiKey,
  from,
  fetch: fetchImpl = fetch,
}: ResendOptions): EmailSender {
  return {
    async send(message: EmailMessage) {
      const response = await fetchImpl(RESEND_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
      });
      // Only the status: the body may echo the recipient.
      if (!response.ok) throw new Error(`Resend rejected the email with status ${response.status}`);
    },
  };
}
