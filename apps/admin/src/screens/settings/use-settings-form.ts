import { zodResolver } from '@hookform/resolvers/zod';
import { t } from '@guaranix/shared';
import { useToast } from '@guaranix/ui';
import type { UseMutationResult } from '@tanstack/react-query';
import { type DefaultValues, type FieldValues, useForm } from 'react-hook-form';
import type { z } from 'zod';

/**
 * A settings form that sends the whole section and starts over from what the
 * server saved. Returns the form and the props `SettingsFormCard` needs.
 */
export function useSettingsForm<Values extends FieldValues>(
  schema: z.ZodType<Values, Values>,
  saved: Values,
  save: UseMutationResult<Values, Error, Values>,
) {
  const toast = useToast();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: saved as DefaultValues<Values>,
  });
  const onSubmit = form.handleSubmit((values) =>
    save.mutate(values, {
      onSuccess: (stored) => {
        form.reset(stored);
        toast.show(t('admin.settings.saved'));
      },
    }),
  );
  return {
    form,
    cardProps: {
      dirty: form.formState.isDirty,
      pending: save.isPending,
      error: save.isError ? save.error : null,
      onSubmit,
    },
  };
}
