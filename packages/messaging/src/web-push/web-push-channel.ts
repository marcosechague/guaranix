import type {
  NotificationChannel,
  OutgoingMessage,
  PushAddress,
  SendResult,
} from '../notifications/channel';
import {
  ChannelError,
  fetchOrRetryable,
  isRetryableStatus,
  retryAfterHeader,
} from '../notifications/channel-error';
import { encryptPushPayload } from './encrypt';
import { type VapidKeys, vapidAuthorization } from './vapid';

export interface WebPushOptions {
  vapid: VapidKeys;
  /** Seconds the push service keeps the message for an offline device. */
  timeToLiveSeconds?: number;
  fetch?: typeof fetch;
  now?: () => Date;
}

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;
const encoder = new TextEncoder();

/** What the service worker receives (`apps/member/public/push-sw.js` reads these fields). */
export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

function payloadOf(message: OutgoingMessage): PushPayload {
  return {
    title: message.title,
    body: message.body,
    ...(message.url ? { url: message.url } : {}),
    ...(message.tag ? { tag: message.tag } : {}),
  };
}

/** Web Push with VAPID, straight to the browser's push service: no third party in between. */
export function createWebPushChannel({
  vapid,
  timeToLiveSeconds = DEFAULT_TTL_SECONDS,
  fetch: fetchImpl = fetch,
  now = () => new Date(),
}: WebPushOptions): NotificationChannel<PushAddress> {
  return {
    channel: 'push',
    async send(address: PushAddress, message: OutgoingMessage): Promise<SendResult> {
      let body: Uint8Array<ArrayBuffer>;
      try {
        body = await encryptPushPayload(
          address,
          new Uint8Array(encoder.encode(JSON.stringify(payloadOf(message)))),
        );
      } catch {
        // A malformed key from the browser will never work.
        throw new ChannelError('address_gone', 'push_invalid_keys');
      }
      const response = await fetchOrRetryable(fetchImpl, address.endpoint, {
        method: 'POST',
        headers: {
          authorization: await vapidAuthorization(vapid, address.endpoint, now()),
          'content-encoding': 'aes128gcm',
          'content-type': 'application/octet-stream',
          ttl: String(timeToLiveSeconds),
          urgency: 'normal',
        },
        body,
      });
      if (response.ok) return { providerMessageId: response.headers.get('location') };
      const code = `push_${response.status}`;
      // 404/410: the user unsubscribed or the browser dropped the subscription.
      if (response.status === 404 || response.status === 410) {
        throw new ChannelError('address_gone', code);
      }
      if (isRetryableStatus(response.status)) {
        throw new ChannelError('retryable', code, retryAfterHeader(response));
      }
      throw new ChannelError('permanent', code);
    },
  };
}
