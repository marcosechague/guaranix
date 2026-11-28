import { zodResolver } from '@hookform/resolvers/zod';
import { type ConnectPaymentAccountInput, connectPaymentAccountSchema, t } from '@guaranix/shared';
import type { PaymentProviderName } from '@guaranix/shared/domain';
import {
  Button,
  FormMessage,
  SegmentedControl,
  SelectField,
  SwitchField,
  TextField,
  useToast,
} from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { Controller, useForm } from 'react-hook-form';
import { useConnectPaymentAccount } from '../../api/card-payments';

export interface ConnectAccountFormProps {
  providers: PaymentProviderName[];
  /** Shown when replacing the keys of a connected account. */
  onDone?: () => void;
}

/** The owner pastes the keys Bancard gave the box. They are tried before being saved. */
export function ConnectAccountForm({ providers, onDone }: ConnectAccountFormProps) {
  const connect = useConnectPaymentAccount();
  const toast = useToast();
  const form = useForm<ConnectPaymentAccountInput>({
    resolver: zodResolver(connectPaymentAccountSchema),
    defaultValues: {
      provider: providers[0] ?? 'bancard',
      environment: 'sandbox',
      publicKey: '',
      privateKey: '',
      autopayEnabled: false,
    },
  });
  const invalid = (field: keyof ConnectPaymentAccountInput) =>
    form.formState.errors[field] ? t('errors.invalid_input') : undefined;

  const submit = form.handleSubmit((values) =>
    connect.mutate(values, {
      onSuccess: () => {
        toast.show(t('admin.settings.cards.connected'));
        onDone?.();
      },
    }),
  );

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField label={t('admin.settings.cards.provider')} {...form.register('provider')}>
          {providers.map((provider) => (
            <option key={provider} value={provider}>
              {t(`admin.settings.cards.providers.${provider}`)}
            </option>
          ))}
        </SelectField>
        <Controller
          control={form.control}
          name="environment"
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t('admin.settings.cards.environment')}</span>
              <SegmentedControl
                label={t('admin.settings.cards.environment')}
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: 'sandbox', label: t('admin.settings.cards.environments.sandbox') },
                  { value: 'production', label: t('admin.settings.cards.environments.production') },
                ]}
              />
            </div>
          )}
        />
        <TextField
          label={t('admin.settings.cards.publicKey')}
          autoComplete="off"
          spellCheck={false}
          error={invalid('publicKey')}
          {...form.register('publicKey')}
        />
        <TextField
          label={t('admin.settings.cards.privateKey')}
          hint={t('admin.settings.cards.privateKeyHint')}
          type="password"
          autoComplete="new-password"
          error={invalid('privateKey')}
          {...form.register('privateKey')}
        />
      </div>
      <Controller
        control={form.control}
        name="autopayEnabled"
        render={({ field }) => (
          <SwitchField
            label={t('admin.settings.cards.autopay')}
            description={t('admin.settings.cards.autopayHint')}
            checked={field.value ?? false}
            onChange={field.onChange}
          />
        )}
      />
      {connect.isError ? <FormMessage tone="error">{errorText(connect.error)}</FormMessage> : null}
      <div className="flex justify-end gap-2">
        {onDone ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            {t('common.cancel')}
          </Button>
        ) : null}
        <Button type="submit" disabled={connect.isPending}>
          {connect.isPending
            ? t('admin.settings.cards.checking')
            : t('admin.settings.cards.connect')}
        </Button>
      </div>
    </form>
  );
}
