import { zodResolver } from '@hookform/resolvers/zod';
import { t } from '@guaranix/shared';
import type { Location } from '@guaranix/shared/api';
import {
  CitySelectField,
  FormMessage,
  Sheet,
  SheetFormActions,
  SwitchField,
  TextField,
  useToast,
} from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useSaveLocation } from '../../api/location-mutations';

const formSchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(240),
  city: z.string().trim().max(120),
  phone: z.union([z.literal(''), z.string().regex(/^\+[1-9]\d{7,14}$/)]),
  isActive: z.boolean(),
  isDefault: z.boolean(),
});
type FormValues = z.infer<typeof formSchema>;

const orNull = (value: string) => value.trim() || null;

/** Only what changed is sent, so moving the default never re-sends it for the old one. */
function toInput(values: FormValues, location: Location | null) {
  const fields = {
    name: values.name.trim(),
    address: orNull(values.address),
    city: orNull(values.city),
    phone: orNull(values.phone),
  };
  if (!location) return fields;
  return {
    ...fields,
    ...(values.isActive !== location.isActive ? { isActive: values.isActive } : {}),
    ...(values.isDefault && !location.isDefault ? { isDefault: true as const } : {}),
  };
}

export interface LocationFormSheetProps {
  /** Null creates a new location. */
  location: Location | null;
  onClose: () => void;
}

export function LocationFormSheet({ location, onClose }: LocationFormSheetProps) {
  const save = useSaveLocation(location?.id ?? null);
  const toast = useToast();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: location?.name ?? '',
      address: location?.address ?? '',
      city: location?.city ?? '',
      phone: location?.phone ?? '',
      isActive: location?.isActive ?? true,
      isDefault: location?.isDefault ?? false,
    },
  });
  const { errors } = form.formState;
  const invalid = (field: keyof FormValues) =>
    errors[field] ? t('errors.invalid_input') : undefined;

  const submit = form.handleSubmit((values) =>
    save.mutate(toInput(values, location), {
      onSuccess: () => {
        toast.show(t('locations.saved'));
        onClose();
      },
    }),
  );

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={location ? t('locations.edit') : t('locations.newTitle')}
      description={t('locations.hint')}
      closeLabel={t('common.close')}
      footer={
        <SheetFormActions formId="location-form" pending={save.isPending} onCancel={onClose} />
      }
    >
      <form id="location-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField
          label={t('locations.name')}
          placeholder={t('locations.namePlaceholder')}
          error={invalid('name')}
          {...form.register('name')}
        />
        <TextField
          label={t('locations.address')}
          error={invalid('address')}
          {...form.register('address')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="city"
            render={({ field }) => (
              <CitySelectField
                label={t('locations.city')}
                error={invalid('city')}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
              />
            )}
          />
          <TextField
            label={t('locations.phone')}
            inputMode="tel"
            hint={t('locations.phoneHint')}
            error={invalid('phone')}
            {...form.register('phone')}
          />
        </div>
        {location && !location.isDefault ? (
          <>
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <SwitchField
                  label={t('locations.open')}
                  description={t('locations.openHint')}
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <SwitchField
                  label={t('locations.makeDefault')}
                  description={t('locations.makeDefaultHint')}
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </>
        ) : null}
        {save.isError ? <FormMessage tone="error">{errorText(save.error)}</FormMessage> : null}
      </form>
    </Sheet>
  );
}
