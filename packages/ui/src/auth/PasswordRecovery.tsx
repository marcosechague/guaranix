import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, passwordSchema, t } from '@guaranix/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../components/Button';
import { FormMessage } from '../components/FormMessage';
import { TextField } from '../components/TextField';
import { useAuth } from './AuthProvider';
import { AuthLayout, errorMessage, TextLink, useCaptcha } from './shared';

const forgotFormSchema = forgotPasswordSchema.omit({ captchaToken: true });

export function ForgotPasswordForm({ onBack }: { onBack(): void }) {
  const { client } = useAuth();
  const captcha = useCaptcha();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const form = useForm<{ email: string }>({ resolver: zodResolver(forgotFormSchema) });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await client.forgotPassword({ ...values, captchaToken: captcha.token });
      setSent(true);
    } catch (caught) {
      setError(errorMessage(caught));
      captcha.reset();
    }
  });

  return (
    <AuthLayout title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')}>
      {sent ? (
        <FormMessage tone="success">{t('auth.forgot.sent')}</FormMessage>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <TextField
            label={t('auth.login.email')}
            type="email"
            autoComplete="email"
            inputMode="email"
            error={errors.email && t('auth.validation.email')}
            {...form.register('email')}
          />
          {captcha.widget}
          {error ? <FormMessage tone="error">{error}</FormMessage> : null}
          <Button type="submit" disabled={isSubmitting || !captcha.ready}>
            {t('auth.forgot.submit')}
          </Button>
        </form>
      )}
      <div className="text-center text-sm">
        <TextLink onClick={onBack}>{t('auth.forgot.back')}</TextLink>
      </div>
    </AuthLayout>
  );
}

const resetFormSchema = z.object({ password: passwordSchema });

/** Opened from the emailed link (`/reset-password?token=…`). */
export function ResetPasswordForm({ token, onDone }: { token: string; onDone(): void }) {
  const { client, setSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<{ password: string }>({ resolver: zodResolver(resetFormSchema) });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async ({ password }) => {
    setError(null);
    try {
      const session = await client.resetPassword({ token, password });
      onDone();
      setSession(session);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  });

  return (
    <AuthLayout title={t('auth.reset.title')}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField
          label={t('auth.reset.password')}
          type="password"
          autoComplete="new-password"
          hint={t('auth.signup.passwordHint')}
          error={errors.password && t('auth.validation.passwordLength')}
          {...form.register('password')}
        />
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <Button type="submit" disabled={isSubmitting}>
          {t('auth.reset.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
