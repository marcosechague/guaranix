import type { ChannelAddress, NotificationChannel, OutgoingMessage, SendResult } from './channel';

export interface SentMessage<Address extends ChannelAddress> {
  address: Address;
  message: OutgoingMessage;
}

export interface MemoryChannel<
  Address extends ChannelAddress,
> extends NotificationChannel<Address> {
  sent: SentMessage<Address>[];
  /** Makes the next sends fail with this error, in order, before succeeding again. */
  failNext(...errors: Error[]): void;
}

/** Keeps sent messages in memory, for tests. */
export function createMemoryChannel<Address extends ChannelAddress>(
  channel: Address['channel'],
): MemoryChannel<Address> {
  const sent: SentMessage<Address>[] = [];
  const failures: Error[] = [];
  let counter = 0;
  return {
    channel,
    sent,
    failNext(...errors) {
      failures.push(...errors);
    },
    async send(address: Address, message: OutgoingMessage): Promise<SendResult> {
      const failure = failures.shift();
      if (failure) throw failure;
      sent.push({ address, message });
      return { providerMessageId: `${channel}-${(counter += 1)}` };
    },
  };
}
