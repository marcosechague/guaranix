import type {
  NotificationChannel,
  OutgoingMessage,
  SendResult,
  WhatsAppAddress,
} from '../notifications/channel';
import { ChannelError, fetchOrRetryable, isRetryableStatus } from '../notifications/channel-error';

export interface WhatsAppCloudOptions {
  /** Permanent token of a Meta system user with `whatsapp_business_messaging`. A Worker secret. */
  accessToken: string;
  /** "Phone number ID" of the sending number (not the number itself). */
  phoneNumberId: string;
  /** Graph API version; Meta supports each one for about two years. */
  apiVersion?: string;
  fetch?: typeof fetch;
}

export const DEFAULT_GRAPH_API_VERSION = 'v23.0';

/** Meta error codes that mean "slow down", see the Cloud API error reference. */
const RATE_LIMIT_CODES = new Set([4, 80007, 130429, 131048, 131056]);
/** The number can't receive this message: not on WhatsApp, or not allowed in test mode. */
const RECIPIENT_CODES = new Set([131026, 131030]);

interface GraphResponse {
  messages?: { id?: string }[];
  error?: { code?: number };
}

async function readGraphResponse(response: Response): Promise<GraphResponse> {
  try {
    return (await response.json()) as GraphResponse;
  } catch {
    return {};
  }
}

/**
 * WhatsApp Cloud API (Meta, no middleman). Reminders are business-initiated,
 * so they always go as an approved template; a message without one is a bug.
 */
export function createWhatsAppCloudChannel({
  accessToken,
  phoneNumberId,
  apiVersion = DEFAULT_GRAPH_API_VERSION,
  fetch: fetchImpl = fetch,
}: WhatsAppCloudOptions): NotificationChannel<WhatsAppAddress> {
  return {
    channel: 'whatsapp',
    async send(address: WhatsAppAddress, message: OutgoingMessage): Promise<SendResult> {
      const template = message.whatsappTemplate;
      if (!template) throw new ChannelError('permanent', 'whatsapp_template_missing');
      const response = await fetchOrRetryable(
        fetchImpl,
        `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: address.phone.replace(/^\+/, ''),
            type: 'template',
            template: {
              name: template.name,
              language: { code: template.language },
              components: [
                {
                  type: 'body',
                  parameters: template.parameters.map((text) => ({ type: 'text', text })),
                },
              ],
            },
          }),
        },
      );
      const json = await readGraphResponse(response);
      const id = json.messages?.[0]?.id;
      if (response.ok && id) return { providerMessageId: id };
      const metaCode = json.error?.code;
      const code = `whatsapp_${metaCode ?? response.status}`;
      if (isRetryableStatus(response.status) || (metaCode && RATE_LIMIT_CODES.has(metaCode))) {
        throw new ChannelError('retryable', code);
      }
      if (metaCode && RECIPIENT_CODES.has(metaCode)) throw new ChannelError('address_gone', code);
      throw new ChannelError('permanent', code);
    },
  };
}
