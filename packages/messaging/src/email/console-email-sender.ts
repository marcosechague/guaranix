import type { EmailMessage, EmailSender } from './email-sender';

type Log = (line: string) => void;

/**
 * Development only: prints the email to the terminal instead of sending it, so
 * you can open reset links locally. It prints secrets by design, which is why
 * `createConsoleEmailSender` refuses to run outside development.
 */
export function createConsoleEmailSender(
  environment: string,
  log: Log = (line) => console.info(line),
): EmailSender {
  if (environment !== 'development') {
    throw new Error('The console email sender is only allowed in development');
  }
  return {
    async send(message: EmailMessage) {
      log(`[dev email] to=${message.to} subject=${message.subject}\n${message.text}`);
    },
  };
}
