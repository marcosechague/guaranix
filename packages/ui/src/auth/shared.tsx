import { AUTH_ERROR_CODES, type AuthErrorCode, t } from '@guaranix/shared';
import { AuthApiError } from '@guaranix/shared/auth-client';
import { type ReactNode, useCallback, useState } from 'react';
import { Brodi } from '../components/Brodi';
import { GoogleButton } from '../components/GoogleButton';
import { Turnstile } from '../components/Turnstile';
import { useAuth } from './AuthProvider';

export function errorFromCode(code: string): string {
  const known = (AUTH_ERROR_CODES as readonly string[]).includes(code)
    ? (code as AuthErrorCode)
    : 'internal_error';
  return t(`auth.errors.${known}`);
}

export function errorMessage(error: unknown): string {
  return errorFromCode(error instanceof AuthApiError ? error.code : 'internal_error');
}

/** Where Google should send the person back: this page, without leftover query params. */
export function currentPageUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-5 py-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <Brodi alt="" size={72} />
        <span className="text-sm text-text-secondary">{t('app.name')}</span>
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {subtitle ? <p className="text-text-secondary">{subtitle}</p> : null}
      </header>
      {children}
    </main>
  );
}

/** "Continuar con Google" and the divider, or nothing when Google is off. */
export function GoogleSection() {
  const { client, config } = useAuth();
  if (!config.googleEnabled) return null;
  return (
    <>
      <GoogleButton
        href={client.googleUrl('login', currentPageUrl())}
        label={t('auth.google.continue')}
      />
      <p className="text-center text-sm text-text-secondary">{t('common.or')}</p>
    </>
  );
}

/**
 * Turnstile token for the next submit. Tokens are single-use, so `reset`
 * re-renders the widget after every attempt. When captcha is off
 * (development), `ready` is always true and no widget is shown.
 */
export function useCaptcha() {
  const { config } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const siteKey = config.turnstileSiteKey;
  const reset = useCallback(() => {
    setToken(null);
    setGeneration((value) => value + 1);
  }, []);
  const widget = siteKey ? (
    <Turnstile
      key={generation}
      siteKey={siteKey}
      onToken={setToken}
      label={t('auth.captcha.label')}
    />
  ) : null;
  return {
    widget,
    ready: !siteKey || token !== null,
    token: token ?? undefined,
    reset,
  };
}

export function TextLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-touch font-semibold text-accent-text underline-offset-4 hover:underline"
    >
      {children}
    </button>
  );
}
