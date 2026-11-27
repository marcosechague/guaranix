export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain-text body. Providers that support HTML can add it later. */
  text: string;
}

/** Any email provider (Resend, Postmark, Cloudflare Email…) implements this. */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
