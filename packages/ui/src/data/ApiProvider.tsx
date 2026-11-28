import { translateApiError } from '@guaranix/shared';
import { ApiError, type ApiClient, createApiClient } from '@guaranix/shared/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { createContext, type ReactNode, use, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

const ApiContext = createContext<ApiClient | null>(null);

function createQueryClient() {
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
}

/** Box API client and query cache for screens behind `<AuthGate>`. */
export function ApiProvider({ apiUrl, children }: ApiProviderProps) {
  const { session } = useAuth();
  const csrfToken = session?.csrfToken ?? null;
  const client = useMemo(
    () => createApiClient({ baseUrl: apiUrl, getCsrfToken: () => csrfToken }),
    [apiUrl, csrfToken],
  );
  const [queryClient] = useState(createQueryClient);
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
