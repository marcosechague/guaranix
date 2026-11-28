import {
  type PlatformPlan,
  platformPlanInputSchema,
  t,
  updatePlatformPlanSchema,
} from '@guaranix/shared';
import {
  Button,
  FormMessage,
  MoneyField,
  Sheet,
  SwitchField,
  TextField,
  useToast,
} from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { useState } from 'react';
import { useSavePlan } from '../../api/queries';

export interface PlanSheetProps {
  /** Null to create a new plan. */
  plan: PlatformPlan | null;
  onClose: () => void;
}

/** GuaraniX's own prices are data: edited here, never in code (CLAUDE.md, Mantenibilidad). */
export function PlanSheet({ plan, onClose }: PlanSheetProps) {
  const toast = useToast();
  const save = useSavePlan(plan?.id ?? null);
  const [code, setCode] = useState(plan?.code ?? '');
  const [name, setName] = useState(plan?.name ?? '');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [monthly, setMonthly] = useState<number | null>(plan?.monthlyPriceGs ?? null);
  const [extra, setExtra] = useState<number | null>(plan?.extraLocationMonthlyPriceGs ?? 99_000);
  const [boxLimit, setBoxLimit] = useState(plan?.boxLimit ? String(plan.boxLimit) : '');
  const [isActive, setIsActive] = useState(plan?.isActive ?? true);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());

  async function submit() {
    const parsed = platformPlanInputSchema.safeParse({
      code: plan?.code ?? code.trim(),
      name,
      description: description.trim() || null,
      monthlyPriceGs: monthly,
      extraLocationMonthlyPriceGs: extra,
      boxLimit: boxLimit === '' ? null : Number(boxLimit),
      isActive,
    });
    if (!parsed.success) {
      setInvalid(new Set(parsed.error.issues.map((issue) => String(issue.path[0]))));
      return;
    }
    // The code is fixed once created; Zod drops it from the update.
    await save.mutateAsync(plan ? updatePlatformPlanSchema.parse(parsed.data) : parsed.data);
    toast.show(t('platform.plans.form.saved'), 'success');
    onClose();
  }

  const error = (field: string) =>
    invalid.has(field) ? t('platform.plans.form.invalid') : undefined;

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={t(plan ? 'platform.plans.form.editTitle' : 'platform.plans.form.newTitle')}
      closeLabel={t('platform.box.close')}
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t('platform.plans.form.cancel')}
          </Button>
          <Button type="submit" form="plan-form" className="flex-1" disabled={save.isPending}>
            {t('platform.plans.form.save')}
          </Button>
        </>
      }
    >
      <form
        id="plan-form"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit().catch(() => undefined);
        }}
      >
        <TextField
          label={t('platform.plans.form.name')}
          value={name}
          error={error('name')}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label={t('platform.plans.form.code')}
          hint={t('platform.plans.form.codeHint')}
          value={plan?.code ?? code}
          disabled={plan !== null}
          error={error('code')}
          onChange={(event) => setCode(event.target.value)}
        />
        <TextField
          label={t('platform.plans.form.description')}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField
            label={t('platform.plans.form.monthlyPrice')}
            value={monthly}
            error={error('monthlyPriceGs')}
            onValueChange={setMonthly}
          />
          <MoneyField
            label={t('platform.plans.form.extraLocationPrice')}
            value={extra}
            error={error('extraLocationMonthlyPriceGs')}
            onValueChange={setExtra}
          />
        </div>
        <TextField
          label={t('platform.plans.form.boxLimit')}
          hint={t('platform.plans.form.boxLimitHint')}
          type="number"
          inputMode="numeric"
          min={1}
          value={boxLimit}
          error={error('boxLimit')}
          onChange={(event) => setBoxLimit(event.target.value)}
        />
        <SwitchField
          label={t('platform.plans.form.active')}
          checked={isActive}
          onChange={setIsActive}
        />
        {save.error ? <FormMessage tone="error">{errorText(save.error)}</FormMessage> : null}
      </form>
    </Sheet>
  );
}
