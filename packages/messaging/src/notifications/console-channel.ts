import type { ChannelAddress, NotificationChannel, OutgoingMessage, SendResult } from './channel';

type Log = (line: string) => void;

function describeAddress(address: ChannelAddress): string {
  switch (address.channel) {
    case 'push':
      return `push endpoint=${new URL(address.endpoint).host}`;
    case 'telegram':
      return `telegram chat=${address.chatId}`;
    case 'whatsapp':
      return `whatsapp phone=${address.phone}`;
  }
}

/**
 * Development only: prints the message instead of sending it, so every event
 * can be tried without a VAPID key, a bot or a WhatsApp Business account.
 */
export function createConsoleChannel<Address extends ChannelAddress>(
  channel: Address['channel'],
  environment: string,
  log: Log = (line) => console.info(line),
): NotificationChannel<Address> {
  if (environment !== 'development') {
    throw new Error('The console notification channel is only allowed in development');
  }
  return {
    channel,
    async send(address: Address, message: OutgoingMessage): Promise<SendResult> {
      const template = message.whatsappTemplate
        ? ` template=${message.whatsappTemplate.name}(${message.whatsappTemplate.parameters.join(' | ')})`
        : '';
      log(
        `[dev ${channel}] ${describeAddress(address)}${template}\n${message.title}\n${message.body}${message.url ? `\n${message.url}` : ''}`,
      );
      return { providerMessageId: null };
    },
  };
}
