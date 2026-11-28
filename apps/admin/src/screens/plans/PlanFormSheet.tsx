import { zodResolver } from '@hookform/resolvers/zod';
import { createPlanSchema, PLAN_KINDS, t } from '@guaranix/shared';
import type { Plan } from '@guaranix/shared/api';
import type { PlanKind } from '@guaranix/shared/domain';
import {
  SheetFormActions,
  FormMessage,
  SegmentedControl,
  SelectField,
  Sheet,
  TextAreaField,
  TextField,
  useToast,
} from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useSavePlan } from '../../api/mutations';

const formSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(PLAN_KINDS),
  priceGs: z.number().int().min(0),
  durationDays: z.number().int().min(1).max(366),
  classesPerWeek: z.number().int().min(1).max(14).nullable(),
  classCount: z.number().int().min(2).max(500).nullable(),
  description: z.string().max(500),
  isActive: z.boolean(),
});
type FormValues = z.infer<typeof formSchema>;

/** Limits only apply to some kinds; the rest are sent as null (see `planLimitIssues`). */
function toInput(values: FormValues, programIds: string[]) {
  return createPlanSchema.parse({
    ...values,
    description: values.description.trim() || null,
    classesPerWeek: values.kind === 'weekly_limit' ? values.classesPerWeek : null,
    classCount:
      values.kind === 'class_pack' ? values.classCount : values.kind === 'drop_in' ? 1 : null,
    programIds,
  });
}

export interface PlanFormSheetProps {
  open: boolean;
  plan: Plan | null;
  onOpenChange: (open: boolean) => void;
}

const numberOrNull = (value: string) => (value === '' ? null : Number(value));

export function PlanFormSheet({ open, plan, onOpenChange }: PlanFormSheetProps) {
  const save = useSavePlan(plan?.id ?? null);
  const toast = useToast();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: plan?.name ?? '',
      kind: plan?.kind ?? 'unlimited',
      priceGs: plan?.priceGs ?? 0,
      durationDays: plan?.durationDays ?? 30,
      classesPerWeek: plan?.classesPerWeek ?? 3,
      classCount: plan?.classCount && plan.classCount > 1 ? plan.classCount : 10,
      description: plan?.description ?? '',
      isActive: plan?.isActive ?? true,
    },
  });
  const kind = useWatch({ control: form.control, name: 'kind' });
  const { errors } = form.formState;
  const invalid = (field: keyof FormValues) =>
    errors[field] ? t('errors.invalid_input') : undefined;

  const submit = form.handleSubmit((values) =>
    save.mutate(toInput(values, plan?.programIds ?? []), {
      onSuccess: () => {
        toast.show(t('admin.plans.saved'));
        onOpenChange(false);
      },
    }),
  );

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={plan ? t('admin.plans.edit') : t('admin.plans.new')}
      closeLabel={t('common.close')}
      footer={
        <SheetFormActions
          formId="plan-form"
          pending={save.isPending}
          onCancel={() => onOpenChange(false)}
        />
      }
    >
      <form id="plan-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField
          label={t('admin.plans.name')}
          error={invalid('name')}
          {...form.register('name')}
        />
        <SelectField label={t('admin.plans.kind')} {...form.register('kind')}>
          {PLAN_KINDS.map((value: PlanKind) => (
            <option key={value} value={value}>
              {t(`plans.kinds.${value}`)}
            </option>
          ))}
        </SelectField>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t('admin.plans.price')}
            inputMode="numeric"
            error={invalid('priceGs')}
            {...form.register('priceGs', { valueAsNumber: true })}
          />
          <TextField
            label={t('admin.plans.duration')}
            inputMode="numeric"
            error={invalid('durationDays')}
            {...form.register('durationDays', { valueAsNumber: true })}
          />
        </div>
        {kind === 'weekly_limit' ? (
          <TextField
            label={t('admin.plans.classesPerWeek')}
            inputMode="numeric"
            error={invalid('classesPerWeek')}
            {...form.register('classesPerWeek', { setValueAs: numberOrNull })}
          />
        ) : null}
        {kind === 'class_pack' ? (
          <TextField
            label={t('admin.plans.classCount')}
            inputMode="numeric"
            error={invalid('classCount')}
            {...form.register('classCount', { setValueAs: numberOrNull })}
          />
        ) : null}
        <TextAreaField label={t('admin.plans.description')} {...form.register('description')} />
        <Controller
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-soft">
                {t('admin.plans.isActive')}
              </span>
              <SegmentedControl
                label={t('admin.plans.isActive')}
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
        {save.isError ? <FormMessage tone="error">{errorText(save.error)}</FormMessage> : null}
      </form>
    </Sheet>
  );
}
