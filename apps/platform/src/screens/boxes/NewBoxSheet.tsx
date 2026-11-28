import {
  BUSINESS_TYPES,
  type BusinessType,
  createPlatformBoxSchema,
  formatGuarani,
  t,
} from '@guaranix/shared';
import {
  Button,
  FormMessage,
  SelectField,
  Sheet,
  SwitchField,
  TextField,
  useToast,
} from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { useState } from 'react';
import { useCreateBox, usePlans } from '../../api/queries';

export interface NewBoxSheetProps {
  open: boolean;
  onClose: () => void;
  onCreated: (boxId: string) => void;
}

const EMPTY = { name: '', city: '', ownerName: '', ownerEmail: '' };
type Field = keyof typeof EMPTY;

/** Manual sign-up for a pilot box, with its owner and the template of its business type. */
export function NewBoxSheet({ open, onClose, onCreated }: NewBoxSheetProps) {
  const toast = useToast();
  const { data: plans = [] } = usePlans();
  const create = useCreateBox();
  const [values, setValues] = useState(EMPTY);
  const [businessType, setBusinessType] = useState<BusinessType>('functional_box');
  const [planId, setPlanId] = useState('');
  const [applyTemplate, setApplyTemplate] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const offered = plans.filter((plan) => plan.isActive);
  const chosenPlanId =
    planId || offered.find((plan) => plan.code === 'founders')?.id || offered[0]?.id || '';

  function close() {
    setValues(EMPTY);
    setErrors({});
    create.reset();
    onClose();
  }

  async function submit() {
    const parsed = createPlatformBoxSchema.safeParse({
      ...values,
      city: values.city.trim() || null,
      businessType,
      platformPlanId: chosenPlanId,
      applyTemplate,
    });
    if (!parsed.success) {
      const fields = new Set(parsed.error.issues.map((issue) => String(issue.path[0])));
      setErrors({
        ...(fields.has('name') ? { name: t('platform.newBox.required') } : {}),
        ...(fields.has('ownerName') ? { ownerName: t('platform.newBox.required') } : {}),
        ...(fields.has('ownerEmail') ? { ownerEmail: t('platform.newBox.invalidEmail') } : {}),
      });
      return;
    }
    const { box } = await create.mutateAsync(parsed.data);
    toast.show(t('platform.newBox.created', { name: box.name }), 'success');
    close();
    onCreated(box.id);
  }

  const field = (name: Field, label: string, extra: Record<string, string> = {}) => (
    <TextField
      label={label}
      value={values[name]}
      error={errors[name]}
      onChange={(event) => {
        setValues({ ...values, [name]: event.target.value });
        setErrors({ ...errors, [name]: undefined });
      }}
      {...extra}
    />
  );

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !next && close()}
      title={t('platform.newBox.title')}
      description={t('platform.newBox.description')}
      closeLabel={t('platform.box.close')}
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={close}>
            {t('platform.newBox.cancel')}
          </Button>
          <Button type="submit" form="new-box" className="flex-1" disabled={create.isPending}>
            {t('platform.newBox.create')}
          </Button>
        </>
      }
    >
      <form
        id="new-box"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit().catch(() => undefined);
        }}
      >
        {field('name', t('platform.newBox.name'), { autoComplete: 'organization' })}
        <div className="grid gap-4 sm:grid-cols-2">
          {field('city', t('platform.newBox.city'), { autoComplete: 'address-level2' })}
          <SelectField
            label={t('platform.newBox.businessType')}
            value={businessType}
            onChange={(event) => setBusinessType(event.target.value as BusinessType)}
          >
            {BUSINESS_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`platform.businessTypes.${type}`)}
              </option>
            ))}
          </SelectField>
        </div>
        <SelectField
          label={t('platform.newBox.plan')}
          value={chosenPlanId}
          onChange={(event) => setPlanId(event.target.value)}
        >
          {offered.map((plan) => {
            const full = plan.boxLimit !== null && plan.boxCount >= plan.boxLimit;
            return (
              <option key={plan.id} value={plan.id} disabled={full}>
                {full
                  ? t('platform.newBox.planFull', { name: plan.name })
                  : t('platform.newBox.planOption', {
                      name: plan.name,
                      amount: formatGuarani(plan.monthlyPriceGs),
                    })}
              </option>
            );
          })}
        </SelectField>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('ownerName', t('platform.newBox.ownerName'), { autoComplete: 'name' })}
          {field('ownerEmail', t('platform.newBox.ownerEmail'), {
            type: 'email',
            autoComplete: 'email',
          })}
        </div>
        <SwitchField
          label={t('platform.newBox.template')}
          description={t('platform.newBox.templateHint')}
          checked={applyTemplate}
          onChange={setApplyTemplate}
        />
        {create.error ? <FormMessage tone="error">{errorText(create.error)}</FormMessage> : null}
      </form>
    </Sheet>
  );
}
