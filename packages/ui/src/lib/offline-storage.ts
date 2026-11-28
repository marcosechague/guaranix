/** Every key the apps write for offline use starts with this, so logout can wipe them all. */
export const OFFLINE_PREFIX = 'guaranix:offline:';

export function readOffline<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(OFFLINE_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeOffline(key: string, value: unknown) {
  try {
    window.localStorage.setItem(OFFLINE_PREFIX + key, JSON.stringify(value));
  } catch {
    // Full or blocked storage: the app keeps working online.
  }
}

/** Removes the cached session and data of whoever used this device. */
export function clearOfflineData() {
  try {
    const keys = Array.from({ length: window.localStorage.length }, (_, index) =>
      window.localStorage.key(index),
    );
    for (const key of keys) {
      if (key?.startsWith(OFFLINE_PREFIX)) window.localStorage.removeItem(key);
    }
  } catch {
    // Nothing stored, nothing to clear.
  }
}
