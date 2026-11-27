import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, t } from '@guaranix/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../components/Button';
import { FormMessage } from '../components/FormMessage';
import { TextField } from '../components/TextField';
import { useAuth } from './AuthProvider';
import { AuthLayout, errorMessage, GoogleSection, TextLink, useCaptcha } from './shared';

const formSchema = loginSchema.omit({ captchaToken: true });
type LoginValues = { email: string; password: string };

export interface LoginFormProps {
  initialError?: string | null;
  onSignup(): void;
  onForgot(): void;
}

export function LoginForm({ initialError, onSignup, onForgot }: LoginFormProps) {
  const { client, config, setSession } = useAuth();
  const captcha = useCaptcha();
  const [error, setError] = useState<string | null>(initialError ?? null);
  const form = useForm<LoginValues>({ resolver: zodResolver(formSchema) });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      setSession(await client.login({ ...values, captchaToken: captcha.token }));
    } catch (caught) {
      setError(errorMessage(caught));
      captcha.reset();
    }
  });

  return (
    <AuthLayout
      title={t('auth.login.title')}
      subtitle={t(config.googleEnabled ? 'auth.login.subtitleWithGoogle' : 'auth.login.subtitle')}
    >
      <GoogleSection />
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField
          label={t('auth.login.email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          error={errors.email && t('auth.validation.email')}
          {...form.register('email')}
        />
        <TextField
          label={t('auth.login.password')}
          type="password"
          autoComplete="current-password"
          error={errors.password && t('auth.validation.required')}
          {...form.register('password')}
        />
        {captcha.widget}
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <Button type="submit" disabled={isSubmitting || !captcha.ready}>
          {t('auth.login.submit')}
        </Button>
      </form>
      <div className="flex flex-col items-center gap-1 text-sm">
        <TextLink onClick={onForgot}>{t('auth.login.forgot')}</TextLink>
        <p className="text-text-secondary">
          {t('auth.login.noAccount')}{' '}
          <TextLink onClick={onSignup}>{t('auth.login.signupLink')}</TextLink>
        </p>
      </div>
    </AuthLayout>
  );
}
