import { translateApiError } from '@guaranix/shared';
import { ApiError, type ApiClient, createApiClient } from '@guaranix/shared/api';
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
  type QueryKey,
} from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { createContext, type ReactNode, use, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { persistQueryCache, restoreQueryCache } from './offline-cache';

const ApiContext = createContext<ApiClient | null>(null);

function createQueryClient() {
  // TanStack only listens for online/offline events; opening the app already offline needs the current value.
  onlineManager.setOnline(navigator.onLine);
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // A 4xx won't fix itself; only retry network and server errors.
        retry: (failureCount, error) =>
          failureCount < 2 && !(error instanceof ApiError && error.status < 500),
        refetchOnWindowFocus: true,
      },
    },
  });
}

export interface ApiProviderProps {
  apiUrl: string;
  children: ReactNode;
  /**
   * Member app: which queries to keep on the device so the app opens without
   * connection. Keep it to what offline needs; never sensitive profile data.
   */
  offlineQueries?: (queryKey: QueryKey) => boolean;
}

/** Box API client and query cache for screens behind `<AuthGate>`. */
export function ApiProvider({ apiUrl, children, offlineQueries }: ApiProviderProps) {
  const { session } = useAuth();
  const csrfToken = session?.csrfToken ?? null;
  // One cache per person and box, so switching account never shows someone else's data.
  const storageKey =
    offlineQueries && session
      ? `queries:${session.user.id}:${session.activeBoxId ?? 'none'}`
      : null;
  const client = useMemo(
    () => createApiClient({ baseUrl: apiUrl, getCsrfToken: () => csrfToken }),
    [apiUrl, csrfToken],
  );
  const [queryClient] = useState(() => {
    const created = createQueryClient();
    if (storageKey) restoreQueryCache(created, storageKey);
    return created;
  });
  useEffect(
    () =>
      storageKey && offlineQueries
        ? persistQueryCache(queryClient, storageKey, offlineQueries)
        : undefined,
    [queryClient, storageKey, offlineQueries],
  );
  return (
    <ApiContext value={client}>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </QueryClientProvider>
    </ApiContext>
  );
}

export function useApi(): ApiClient {
  const client = use(ApiContext);
  if (!client) throw new Error('useApi must be used inside <ApiProvider>');
  return client;
}

/** The es-PY text for whatever a query or mutation threw. */
export function errorText(error: unknown): string {
  return translateApiError(error instanceof ApiError ? error.code : 'internal_error');
}
