import { dehydrate, type DehydratedState, hydrate, type QueryClient } from '@tanstack/react-query';
import { readOffline, writeOffline } from '../lib/offline-storage';

// A week covers "I trained Monday, the gym has no signal Tuesday"; older data is more confusing than useful.
const MAX_AGE_MS = 7 * 24 * 60 * 60_000;
const SAVE_DELAY_MS = 1_000;

interface StoredCache {
  savedAt: number;
  state: DehydratedState;
}

/**
 * Keeps the last good answer of every query in localStorage, so the app opens
 * offline with what it showed last time (cache first, then network).
 * Call it before the first render so screens start with that data.
 */
export function restoreQueryCache(queryClient: QueryClient, storageKey: string) {
  const stored = readOffline<StoredCache>(storageKey);
  if (stored && Date.now() - stored.savedAt < MAX_AGE_MS) hydrate(queryClient, stored.state);
}

/** Saves after each successful fetch, debounced; returns the unsubscribe. */
export function persistQueryCache(queryClient: QueryClient, storageKey: string): () => void {
  let pending: number | undefined;
  const save = () => {
    pending = undefined;
    const state = dehydrate(queryClient, {
      shouldDehydrateQuery: (query) =>
        query.state.status === 'success' && Date.now() - query.state.dataUpdatedAt < MAX_AGE_MS,
    });
    writeOffline(storageKey, { savedAt: Date.now(), state } satisfies StoredCache);
  };
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return;
    window.clearTimeout(pending);
    pending = window.setTimeout(save, SAVE_DELAY_MS);
  });
  return () => {
    window.clearTimeout(pending);
    unsubscribe();
  };
}

/** When the newest data on screen was fetched; null if nothing is cached. */
export function newestDataAt(queryClient: QueryClient): number | null {
  const times = queryClient
    .getQueryCache()
    .getAll()
    .map((query) => query.state.dataUpdatedAt)
    .filter((time) => time > 0);
  return times.length > 0 ? Math.max(...times) : null;
}
