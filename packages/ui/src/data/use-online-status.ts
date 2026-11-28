import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** The same online flag TanStack Query uses to pause and resume requests. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );
}
