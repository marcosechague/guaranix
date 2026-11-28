import { zodResolver } from '@hookform/resolvers/zod';
import { createMemberSchema, t } from '@guaranix/shared';
import type { Member } from '@guaranix/shared/api';
import { FormMessage, Sheet, SheetFormActions, TextField, useToast } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useCreateMember } from '../../api/mutations';

// Optional fields arrive as empty strings from the inputs; the API wants them absent.
const blankToUndefined = (value: unknown) => (value === '' ? undefined : value);
const formSchema = z.object({
  firstName: createMemberSchema.shape.firstName,
  lastName: createMemberSchema.shape.lastName,
  documentNumber: z.preprocess(blankToUndefined, createMemberSchema.shape.documentNumber),
  phone: z.preprocess(blankToUndefined, createMemberSchema.shape.phone),
  email: z.preprocess(blankToUndefined, createMemberSchema.shape.email),
});
type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

export interface MemberFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (member: Member) => void;
}

export function MemberFormSheet({ open, onOpenChange, onCreated }: MemberFormSheetProps) {
  const form = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(formSchema) });
  const create = useCreateMember();
  const toast = useToast();
  const { errors } = form.formState;
  const invalid = (field: keyof FormInput) =>
    errors[field] ? t('errors.invalid_input') : undefined;

  const submit = form.handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: (member) => {
        toast.show(t('admin.members.created'));
        form.reset();
        onCreated(member);
      },
    }),
  );

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('admin.members.new')}
      closeLabel={t('common.close')}
      footer={
        <SheetFormActions
          formId="member-form"
          pending={create.isPending}
          onCancel={() => onOpenChange(false)}
        />
      }
    >
      <form id="member-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t('admin.members.firstName')}
            autoComplete="off"
            error={invalid('firstName')}
            {...form.register('firstName')}
          />
          <TextField
            label={t('admin.members.lastName')}
            autoComplete="off"
            error={invalid('lastName')}
            {...form.register('lastName')}
          />
        </div>
        <TextField
          label={t('admin.members.document')}
          inputMode="numeric"
          error={invalid('documentNumber')}
          {...form.register('documentNumber')}
        />
        <TextField
          label={t('admin.members.phone')}
          type="tel"
          placeholder="+595981123456"
          error={invalid('phone')}
          {...form.register('phone')}
        />
        <TextField
          label={t('admin.members.email')}
          type="email"
          error={invalid('email')}
          {...form.register('email')}
        />
        {create.isError ? <FormMessage tone="error">{errorText(create.error)}</FormMessage> : null}
      </form>
    </Sheet>
  );
}
