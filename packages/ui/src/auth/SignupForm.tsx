import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema, t } from '@guaranix/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../components/Button';
import { FormMessage } from '../components/FormMessage';
import { TextField } from '../components/TextField';
import { useAuth } from './AuthProvider';
import { AuthLayout, errorMessage, GoogleSection, TextLink, useCaptcha } from './shared';

const formSchema = signupSchema.omit({ captchaToken: true });
type SignupValues = { fullName: string; email: string; password: string };

export function SignupForm({ onLogin }: { onLogin(): void }) {
  const { client, setSession } = useAuth();
  const captcha = useCaptcha();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<SignupValues>({ resolver: zodResolver(formSchema) });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      setSession(await client.signup({ ...values, captchaToken: captcha.token }));
    } catch (caught) {
      setError(errorMessage(caught));
      captcha.reset();
    }
  });

  return (
    <AuthLayout title={t('auth.signup.title')}>
      <GoogleSection />
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField
          label={t('auth.signup.fullName')}
          autoComplete="name"
          error={errors.fullName && t('auth.validation.required')}
          {...form.register('fullName')}
        />
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
          autoComplete="new-password"
          hint={t('auth.signup.passwordHint')}
          error={errors.password && t('auth.validation.passwordLength')}
          {...form.register('password')}
        />
        {captcha.widget}
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <Button type="submit" disabled={isSubmitting || !captcha.ready}>
          {t('auth.signup.submit')}
        </Button>
      </form>
      <p className="text-center text-sm text-text-secondary">
        {t('auth.signup.hasAccount')}{' '}
        <TextLink onClick={onLogin}>{t('auth.signup.loginLink')}</TextLink>
      </p>
    </AuthLayout>
  );
}
