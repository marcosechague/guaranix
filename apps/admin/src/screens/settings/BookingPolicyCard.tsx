import { zodResolver } from '@hookform/resolvers/zod';
import { bookingPolicySchema, t } from '@guaranix/shared';
import type { BookingPolicy } from '@guaranix/shared/schemas';
import { Card, FormSaveActions, SegmentedControl, TextField, useToast } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { type Control, Controller, useForm } from 'react-hook-form';
import { useSaveBookingPolicy } from '../../api/mutations';

type ToggleField = 'lateCancelConsumesCredit' | 'noShowConsumesCredit' | 'waitlistAutoPromote';

function PolicyToggle({
  control,
  name,
  label,
  disabled,
}: {
  control: Control<BookingPolicy>;
  name: ToggleField;
  label: string;
  disabled: boolean;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium">{label}</span>
          <SegmentedControl
            label={label}
            className={disabled ? 'pointer-events-none opacity-60' : undefined}
            value={field.value ? 'yes' : 'no'}
            onChange={(value) => field.onChange(value === 'yes')}
            options={[
              { value: 'yes', label: t('common.yes') },
              { value: 'no', label: t('common.no') },
            ]}
          />
        </div>
      )}
    />
  );
}

export interface BookingPolicyCardProps {
  policy: BookingPolicy;
  editable: boolean;
}

export function BookingPolicyCard({ policy, editable }: BookingPolicyCardProps) {
  const save = useSaveBookingPolicy();
  const toast = useToast();
  const form = useForm<BookingPolicy>({
    resolver: zodResolver(bookingPolicySchema),
    defaultValues: policy,
  });
  const { errors, isDirty } = form.formState;
  const invalid = (field: keyof BookingPolicy) =>
    errors[field] ? t('errors.invalid_input') : undefined;
  const numeric = { valueAsNumber: true } as const;

  const submit = form.handleSubmit((values) =>
    save.mutate(values, {
      onSuccess: (saved) => {
        form.reset(saved);
        toast.show(t('admin.settings.saved'));
      },
    }),
  );

  return (
    <Card as="section">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold">{t('admin.settings.bookingTitle')}</h2>
        <p className="text-sm text-text-secondary">
          {editable ? t('admin.settings.bookingHint') : t('admin.settings.readOnly')}
        </p>
      </div>
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <fieldset disabled={!editable} className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <TextField
              label={t('admin.settings.opensHours')}
              hint={t('admin.settings.opensHint')}
              inputMode="numeric"
              error={invalid('bookingOpensHoursBefore')}
              {...form.register('bookingOpensHoursBefore', numeric)}
            />
            <TextField
              label={t('admin.settings.closesMinutes')}
              hint={t('admin.settings.closesHint')}
              inputMode="numeric"
              error={invalid('bookingClosesMinutesBefore')}
              {...form.register('bookingClosesMinutesBefore', numeric)}
            />
            <TextField
              label={t('admin.settings.lateCancelMinutes')}
              hint={t('admin.settings.lateCancelHint')}
              inputMode="numeric"
              error={invalid('lateCancelMinutesBefore')}
              {...form.register('lateCancelMinutesBefore', numeric)}
            />
          </div>
          <div className="flex flex-col gap-4 border-t border-divider pt-4">
            <PolicyToggle
              control={form.control}
              name="lateCancelConsumesCredit"
              label={t('admin.settings.lateCancelConsumes')}
              disabled={!editable}
            />
            <PolicyToggle
              control={form.control}
              name="noShowConsumesCredit"
              label={t('admin.settings.noShowConsumes')}
              disabled={!editable}
            />
            <PolicyToggle
              control={form.control}
              name="waitlistAutoPromote"
              label={t('admin.settings.waitlistAutoPromote')}
              disabled={!editable}
            />
          </div>
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
