import { checkInPolicySchema, t } from '@guaranix/shared';
import type { CheckInPolicy } from '@guaranix/shared/schemas';
import { SwitchField, TextField } from '@guaranix/ui';
import { type Control, Controller, useWatch } from 'react-hook-form';
import { useSaveCheckInPolicy } from '../../api/check-in-settings';
import { SettingsFormCard } from './SettingsFormCard';
import { useSettingsForm } from './use-settings-form';

type ModeField = 'checkInDeskEnabled' | 'checkInCoachEnabled' | 'checkInWallQrEnabled';

const MODES: { field: ModeField; key: 'desk' | 'coach' | 'wallQr' }[] = [
  { field: 'checkInDeskEnabled', key: 'desk' },
  { field: 'checkInCoachEnabled', key: 'coach' },
  { field: 'checkInWallQrEnabled', key: 'wallQr' },
];

function ModeSwitch({
  control,
  field,
  modeKey,
  disabled,
}: {
  control: Control<CheckInPolicy>;
  field: ModeField;
  modeKey: (typeof MODES)[number]['key'];
  disabled: boolean;
}) {
  return (
    <Controller
      control={control}
      name={field}
      render={({ field: input }) => (
        <SwitchField
          label={t(`admin.settings.checkIn.${modeKey}`)}
          description={t(`admin.settings.checkIn.${modeKey}Hint`)}
          checked={input.value}
          onChange={input.onChange}
          disabled={disabled}
        />
      )}
    />
  );
}

export interface CheckInModesCardProps {
  policy: CheckInPolicy;
  editable: boolean;
}

/** Which ways of marking attendance the box uses; any combination, none is allowed too. */
export function CheckInModesCard({ policy, editable }: CheckInModesCardProps) {
  const save = useSaveCheckInPolicy();
  const { form, cardProps } = useSettingsForm(checkInPolicySchema, policy, save);
  const { errors } = form.formState;
  const wallQr = useWatch({ control: form.control, name: 'checkInWallQrEnabled' });

  return (
    <SettingsFormCard
      title={t('admin.settings.checkIn.title')}
      hint={t('admin.settings.checkIn.hint')}
      editable={editable}
      {...cardProps}
    >
      <fieldset disabled={!editable} className="flex flex-col gap-3">
        {MODES.map((mode) => (
          <ModeSwitch
            key={mode.field}
            control={form.control}
            field={mode.field}
            modeKey={mode.key}
            disabled={!editable}
          />
        ))}
        {wallQr ? (
          <TextField
            label={t('admin.settings.checkIn.radius')}
            hint={t('admin.settings.checkIn.radiusHint')}
            inputMode="numeric"
            error={
              errors.checkInRadiusMeters ? t('admin.settings.checkIn.radiusInvalid') : undefined
            }
            {...form.register('checkInRadiusMeters', { valueAsNumber: true })}
          />
        ) : null}
      </fieldset>
    </SettingsFormCard>
  );
}
