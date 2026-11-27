import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema, t } from '@guaranix/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../components/Button';
import { FormMessage } from '../components/FormMessage';
import { GoogleButton } from '../components/GoogleButton';
import { TextField } from '../components/TextField';
import { useAuth, useSession } from './AuthProvider';
import { currentPageUrl, errorMessage } from './shared';

const changeSchema = z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema });
const createSchema = z.object({ newPassword: passwordSchema });
type PasswordValues = { currentPassword?: string; newPassword: string };

function PasswordForm() {
  const { client, setSession } = useAuth();
  const { hasPassword } = useSession();
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const form = useForm<PasswordValues>({
    resolver: zodResolver(hasPassword ? changeSchema : createSchema),
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setMessage(null);
    try {
      setSession(await client.setPassword(values));
      form.reset();
      setMessage({ tone: 'success', text: t('auth.account.saved') });
    } catch (caught) {
      setMessage({ tone: 'error', text: errorMessage(caught) });
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <p className="text-text-secondary">
        {hasPassword ? t('auth.account.passwordSet') : t('auth.account.passwordMissing')}
      </p>
      {hasPassword ? (
        <TextField
          label={t('auth.account.currentPassword')}
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword && t('auth.validation.required')}
          {...form.register('currentPassword')}
        />
      ) : null}
      <TextField
        label={t('auth.account.newPassword')}
        type="password"
        autoComplete="new-password"
        hint={t('auth.signup.passwordHint')}
        error={errors.newPassword && t('auth.validation.passwordLength')}
        {...form.register('newPassword')}
      />
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
      <Button type="submit" variant="secondary" disabled={isSubmitting}>
        {hasPassword ? t('auth.account.changePassword') : t('auth.account.createPassword')}
      </Button>
    </form>
  );
}

function GoogleLink() {
  const { client, config, setSession } = useAuth();
  const { googleLinked } = useSession();
  const [error, setError] = useState<string | null>(null);
  if (!config.googleEnabled && !googleLinked) return null;

  const unlink = async () => {
    setError(null);
    try {
      setSession(await client.unlinkGoogle());
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  return (
    <div className="flex flex-col gap-3 border-t border-divider pt-4">
      <p className="text-text-secondary">
        {googleLinked ? t('auth.google.linked') : t('auth.google.notLinked')}
      </p>
      {googleLinked ? (
        <Button type="button" variant="ghost" onClick={unlink}>
          {t('auth.google.unlink')}
        </Button>
      ) : (
        <GoogleButton
          href={client.googleUrl('link', currentPageUrl())}
          label={t('auth.google.link')}
        />
      )}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  );
}

/** Password and Google settings, plus logout. */
export function AccountSecurity() {
  const { client, setSession } = useAuth();
  const logout = async () => {
    await client.logout().catch(() => undefined);
    setSession(null);
  };

  return (
    <section
      aria-labelledby="account-security-title"
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
    >
      <h2 id="account-security-title" className="font-display text-lg font-bold">
        {t('auth.account.title')}
      </h2>
      <PasswordForm />
      <GoogleLink />
      <div className="border-t border-divider pt-4">
        <Button type="button" variant="ghost" onClick={logout} className="w-full">
          {t('auth.account.logout')}
        </Button>
      </div>
    </section>
  );
}
