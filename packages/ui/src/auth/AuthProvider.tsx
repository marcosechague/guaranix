import type { AuthConfig, Session } from '@guaranix/shared';
import { type AuthClient, createAuthClient } from '@guaranix/shared/auth-client';
import { createContext, type ReactNode, use, useEffect, useMemo, useState } from 'react';

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
}

export function AuthProvider({ apiUrl, children }: AuthProviderProps) {
  const client = useMemo(() => createAuthClient({ baseUrl: apiUrl }), [apiUrl]);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [config, setConfig] = useState<AuthConfig>(FALLBACK_CONFIG);

  useEffect(() => {
    let active = true;
    Promise.all([client.getSession(), client.getConfig().catch(() => FALLBACK_CONFIG)])
      .then(([loaded, loadedConfig]) => {
        if (!active) return;
        setConfig(loadedConfig);
        setSession(loaded);
      })
      .catch(() => active && setSession(null));
    return () => {
      active = false;
    };
  }, [client]);

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
