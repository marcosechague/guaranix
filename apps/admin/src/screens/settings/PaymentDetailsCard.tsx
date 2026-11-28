import { zodResolver } from '@hookform/resolvers/zod';
import { boxPaymentDetailsSchema, t } from '@guaranix/shared';
import type {
  BoxPaymentDetails,
  BoxPaymentDetailsFields,
  BoxPaymentDetailsInput,
} from '@guaranix/shared/schemas';
import { Card, FormSaveActions, TextAreaField, TextField, useToast } from '@guaranix/ui';
import { errorText, useSavePaymentDetails } from '@guaranix/ui/data';
import { useForm } from 'react-hook-form';
import { PaymentQrField } from './PaymentQrField';

type FormValues = BoxPaymentDetailsInput;

const toForm = (details: BoxPaymentDetails): FormValues => ({
  bankName: details.bankName ?? '',
  accountNumber: details.accountNumber ?? '',
  alias: details.alias ?? '',
  holderName: details.holderName ?? '',
  holderDocument: details.holderDocument ?? '',
  note: details.note ?? '',
});

export interface PaymentDetailsCardProps {
  details: BoxPaymentDetails;
  editable: boolean;
}

export function PaymentDetailsCard({ details, editable }: PaymentDetailsCardProps) {
  const save = useSavePaymentDetails();
  const toast = useToast();
  const form = useForm<FormValues, unknown, BoxPaymentDetailsFields>({
    resolver: zodResolver(boxPaymentDetailsSchema),
    defaultValues: toForm(details),
  });
  const { errors, isDirty } = form.formState;
  const invalid = (field: keyof FormValues) =>
    errors[field] ? t('errors.invalid_input') : undefined;

  const submit = form.handleSubmit((values) =>
    save.mutate(values, {
      onSuccess: (saved) => {
        form.reset(toForm(saved));
        toast.show(t('admin.settings.saved'));
      },
    }),
  );

  return (
    <Card as="section">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold">{t('admin.settings.paymentTitle')}</h2>
        <p className="text-sm text-text-secondary">
          {editable ? t('admin.settings.paymentHint') : t('admin.settings.readOnly')}
        </p>
      </div>
      <PaymentQrField hasQr={details.hasQr} editable={editable} />
      <form
        noValidate
        onSubmit={submit}
        className="flex flex-col gap-5 border-t border-divider pt-4"
      >
        <fieldset disabled={!editable} className="grid gap-4 md:grid-cols-2">
          <TextField
            label={t('admin.settings.bankName')}
            error={invalid('bankName')}
            {...form.register('bankName')}
          />
          <TextField
            label={t('admin.settings.accountNumber')}
            inputMode="numeric"
            error={invalid('accountNumber')}
            {...form.register('accountNumber')}
          />
          <TextField
            label={t('admin.settings.alias')}
            hint={t('admin.settings.aliasHint')}
            error={invalid('alias')}
            {...form.register('alias')}
          />
          <TextField
            label={t('admin.settings.holderName')}
            error={invalid('holderName')}
            {...form.register('holderName')}
          />
          <TextField
            label={t('admin.settings.holderDocument')}
            hint={t('admin.settings.holderDocumentHint')}
            error={invalid('holderDocument')}
            {...form.register('holderDocument')}
          />
          <TextAreaField
            className="md:col-span-2"
            label={t('admin.settings.paymentNote')}
            placeholder={t('admin.settings.paymentNotePlaceholder')}
            error={invalid('note')}
            {...form.register('note')}
          />
        </fieldset>
        <FormSaveActions
          editable={editable}
          dirty={isDirty}
          pending={save.isPending}
          error={save.isError ? errorText(save.error) : null}
        />
      </form>
    </Card>
  );
}
