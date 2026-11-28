/** An automatic charge failed: the member gets the link to pay it another way. */
export interface PaymentFailedNotice {
  boxId: string;
  memberId: string;
  chargeId: string;
  amountGs: number;
  description: string;
  /** Full payment link, valid until `linkExpiresAt`. */
  linkUrl: string;
  linkExpiresAt: Date;
  /** WhatsApp chat with the message ready, when the member has a mobile number. */
  whatsappUrl: string | null;
  attemptNumber: number;
  /** No more automatic retries after this one. */
  finalAttempt: boolean;
}

/**
 * Side outlet for failure notices. The member's push goes through the
 * notifications outbox (`card_payment_failed`); this is for what can't go
 * there, like the link itself, which is a secret and stays out of messages
 * until a WhatsApp template for it is approved.
 */
export interface PaymentNotifier {
  paymentFailed(notice: PaymentFailedNotice): Promise<void>;
}

/** Logs that a notice is due, without the link (it works as a password) or member data. */
export function createLoggingPaymentNotifier(): PaymentNotifier {
  return {
    async paymentFailed(notice) {
      console.log('Card autopay failed; payment link created', {
        boxId: notice.boxId,
        chargeId: notice.chargeId,
        attemptNumber: notice.attemptNumber,
        finalAttempt: notice.finalAttempt,
      });
    },
  };
}

/** Keeps every notice, for tests. */
export function createMemoryPaymentNotifier(): PaymentNotifier & { sent: PaymentFailedNotice[] } {
  const sent: PaymentFailedNotice[] = [];
  return {
    sent,
    async paymentFailed(notice) {
      sent.push(notice);
    },
  };
}
