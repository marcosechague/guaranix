import type { AuthConfig, Session } from '@guaranix/shared';
import { AuthApiError, type AuthClient, createAuthClient } from '@guaranix/shared/auth-client';
import { createContext, type ReactNode, use, useEffect, useMemo, useState } from 'react';
import { clearOfflineData, readOffline, writeOffline } from '../lib/offline-storage';

interface AuthState {
  client: AuthClient;
  /** Undefined while loading; null when logged out. */
  session: Session | null | undefined;
  config: AuthConfig;
  setSession(session: Session | null): void;
}

const AuthContext = createContext<AuthState | null>(null);

const FALLBACK_CONFIG: AuthConfig = { googleEnabled: false, turnstileSiteKey: null };

export interface AuthProviderProps {
  apiUrl: string;
  children: ReactNode;
  /**
   * Member app: with no connection, open with the last session seen on this
   * device instead of the login form. It never acts as a credential: the
   * HttpOnly cookie still authorizes every request.
   */
  offline?: boolean;
}

const SESSION_KEY = 'session';

/** A network failure, not the API saying no: only then is the saved session worth using. */
const isNetworkError = (error: unknown) => !(error instanceof AuthApiError);

export function AuthProvider({ apiUrl, children, offline = false }: AuthProviderProps) {
  const client = useMemo(() => createAuthClient({ baseUrl: apiUrl }), [apiUrl]);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [config, setConfig] = useState<AuthConfig>(FALLBACK_CONFIG);

  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([client.getSession(), client.getConfig().catch(() => FALLBACK_CONFIG)])
      .then(([loaded, loadedConfig]) => {
        if (!active) return;
        setConfig(loadedConfig);
        setSession(loaded);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const saved = offline && isNetworkError(error) ? readOffline<Session>(SESSION_KEY) : null;
        setSession(saved);
      });
    return () => {
      active = false;
    };
  }, [client, offline, reload]);

  // A saved session has no CSRF token: fetch the real one as soon as the connection is back.
  const usingSavedSession = session?.csrfToken === '';
  useEffect(() => {
    if (!usingSavedSession) return;
    const onOnline = () => setReload((count) => count + 1);
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [usingSavedSession]);

  useEffect(() => {
    if (session === null) clearOfflineData();
    else if (offline && session && session.csrfToken !== '' && !session.impersonation) {
      writeOffline(SESSION_KEY, { ...session, csrfToken: '' } satisfies Session);
    }
  }, [offline, session]);

  const value = useMemo(() => ({ client, session, config, setSession }), [client, session, config]);
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const state = use(AuthContext);
  if (!state) throw new Error('useAuth must be used inside <AuthProvider>');
  return state;
}

/** For screens behind the gate, where a session is guaranteed. */
export function useSession(): Session {
  const { session } = useAuth();
  if (!session) throw new Error('useSession must be used behind <AuthGate>');
  return session;
}
