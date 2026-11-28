import type { PushSubscriptionInput } from '@guaranix/shared';

export type PushSupport = 'supported' | 'unsupported' | 'denied';

/** iPhone only offers push to an app added to the home screen, so "unsupported" covers Safari tabs. */
export function pushSupport(): PushSupport {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return 'unsupported';
  }
  return Notification.permission === 'denied' ? 'denied' : 'supported';
}

function applicationServerKey(publicKey: string): Uint8Array<ArrayBuffer> {
  const base64 = publicKey.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() === 'unsupported') return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Asks for permission and subscribes this browser. Null when the person said no. */
export async function subscribeToPush(publicKey: string): Promise<PushSubscriptionInput | null> {
  if ((await Notification.requestPermission()) !== 'granted') return null;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey(publicKey),
  });
  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    keys: { p256dh: json.keys?.['p256dh'] ?? '', auth: json.keys?.['auth'] ?? '' },
  };
}

/**
 * Stops push in this browser before logging out and returns its endpoint, so
 * the API can forget it too. Never throws: logging out must always work.
 */
export async function unsubscribeThisBrowser(): Promise<string | undefined> {
  try {
    const subscription = await currentPushSubscription();
    if (!subscription) return undefined;
    await subscription.unsubscribe();
    return subscription.endpoint;
  } catch {
    return undefined;
  }
}
