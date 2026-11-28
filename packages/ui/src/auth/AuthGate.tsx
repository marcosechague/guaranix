import type { Session } from '@guaranix/shared';
import { type ReactNode, useState } from 'react';
import { useAuth } from './AuthProvider';
import { LoginForm } from './LoginForm';
import { ForgotPasswordForm, ResetPasswordForm } from './PasswordRecovery';
import { SignupForm } from './SignupForm';
import { errorFromCode } from './shared';

type Screen = 'login' | 'signup' | 'forgot';

/** Google sends errors back as `?auth_error=code`; read it once and clean the URL. */
function takeRedirectError(): string | null {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('auth_error');
  if (!code) return null;
  url.searchParams.delete('auth_error');
  window.history.replaceState(null, '', url);
  return errorFromCode(code);
}

function takeResetToken(): string | null {
  const url = new URL(window.location.href);
  // Any app may receive the link, under its own base path (`/panel/reset-password`).
  return url.pathname.endsWith('/reset-password') ? url.searchParams.get('token') : null;
}

function GateSkeleton() {
  return (
    <main
      aria-busy="true"
      className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-4 px-5"
    >
      <div className="mx-auto size-18 animate-pulse rounded-pill bg-surface motion-reduce:animate-none" />
      <div className="h-8 animate-pulse rounded-md bg-surface motion-reduce:animate-none" />
      <div className="h-11 animate-pulse rounded-md bg-surface motion-reduce:animate-none" />
      <div className="h-11 animate-pulse rounded-md bg-surface motion-reduce:animate-none" />
    </main>
  );
}

export interface AuthGateProps {
  children: (session: Session) => ReactNode;
  /** False for the platform: its accounts are created by GuaraniX, never signed up. */
  allowSignup?: boolean;
}

/** Shows login, signup or password recovery until there is a session, then the app. */
export function AuthGate({ children, allowSignup = true }: AuthGateProps) {
  const { session } = useAuth();
  const [screen, setScreen] = useState<Screen>('login');
  const [redirectError] = useState(takeRedirectError);
  const [resetToken, setResetToken] = useState(takeResetToken);

  if (resetToken) {
    return (
      <ResetPasswordForm
        token={resetToken}
        onDone={() => {
          const appRoot = window.location.pathname.replace(/reset-password$/, '');
          window.history.replaceState(null, '', appRoot);
          setResetToken(null);
        }}
      />
    );
  }
  if (session === undefined) return <GateSkeleton />;
  if (session) {
    // After logging out, start again at login, not at the form used to get in.
    if (screen !== 'login') setScreen('login');
    return children(session);
  }
  if (screen === 'signup' && allowSignup) return <SignupForm onLogin={() => setScreen('login')} />;
  if (screen === 'forgot') return <ForgotPasswordForm onBack={() => setScreen('login')} />;
  return (
    <LoginForm
      initialError={redirectError}
      {...(allowSignup ? { onSignup: () => setScreen('signup') } : {})}
      onForgot={() => setScreen('forgot')}
    />
  );
}
