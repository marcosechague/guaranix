import { SCORE_TYPES, TIMER_TYPES, WORKOUT_COMPONENT_KINDS, t } from '@guaranix/shared';
import type { Movement } from '@guaranix/shared/api';
import { Card, IconButton, SelectField, TextAreaField, TextField } from '@guaranix/ui';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { type UseFormReturn, useWatch } from 'react-hook-form';
import { GuidedStepsEditor } from './GuidedStepsEditor';
import type { WorkoutFormValues } from './workout-form';

export interface ComponentEditorProps {
  form: UseFormReturn<WorkoutFormValues>;
  index: number;
  count: number;
  movements: readonly Movement[];
  onMove: (to: number) => void;
  onRemove: () => void;
}

export function ComponentEditor({
  form,
  index,
  count,
  movements,
  onMove,
  onRemove,
}: ComponentEditorProps) {
  const name = `components.${index}` as const;
  const timerType = useWatch({ control: form.control, name: `${name}.timerType` });
  const scoreType = useWatch({ control: form.control, name: `${name}.scoreType` });
  const movementId = useWatch({ control: form.control, name: `${name}.movementId` });
  const guided = timerType !== 'none';
  const fieldErrors = form.formState.errors.components?.[index];
  const invalid = (field: keyof NonNullable<typeof fieldErrors>) =>
    fieldErrors?.[field] ? t('errors.invalid_input') : undefined;
  const number = (
    field:
      | 'timeCapMinutes'
      | 'rounds'
      | 'intervalSeconds'
      | 'workSeconds'
      | 'restSeconds'
      | 'loadPercent',
    label: string,
  ) => (
    <TextField
      label={label}
      inputMode="numeric"
      error={invalid(field)}
      {...form.register(`${name}.${field}`)}
    />
  );

  return (
    <Card as="li" spacing="regular">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-bold">
          {t('admin.wod.part', { number: index + 1 })}
        </h3>
        <div className="flex items-center gap-1">
          <IconButton
            variant="ghost"
            label={t('admin.wod.moveUp')}
            disabled={index === 0}
            onClick={() => onMove(index - 1)}
          >
            <ArrowUp aria-hidden="true" size={18} />
          </IconButton>
          <IconButton
            variant="ghost"
            label={t('admin.wod.moveDown')}
            disabled={index === count - 1}
            onClick={() => onMove(index + 1)}
          >
            <ArrowDown aria-hidden="true" size={18} />
          </IconButton>
          <IconButton
            variant="ghost"
            label={t('admin.wod.removeComponent')}
            disabled={count === 1}
            onClick={onRemove}
          >
            <Trash2 aria-hidden="true" size={18} />
          </IconButton>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label={t('admin.wod.kind')} {...form.register(`${name}.kind`)}>
          {WORKOUT_COMPONENT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`workout.kinds.${kind}`)}
            </option>
          ))}
        </SelectField>
        <TextField label={t('admin.wod.componentTitle')} {...form.register(`${name}.title`)} />
      </div>
      <TextAreaField
        label={t('admin.wod.description')}
        rows={5}
        error={invalid('description')}
        {...form.register(`${name}.description`)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label={t('admin.wod.timerType')} {...form.register(`${name}.timerType`)}>
          {TIMER_TYPES.map((timer) => (
            <option key={timer} value={timer}>
              {t(`workout.timers.${timer}`)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t('admin.wod.scoreType')} {...form.register(`${name}.scoreType`)}>
          {SCORE_TYPES.map((score) => (
            <option key={score} value={score}>
              {t(`workout.scoreTypes.${score}`)}
            </option>
          ))}
        </SelectField>
      </div>
      {timerType === 'none' ? null : (
        <div className="grid gap-4 sm:grid-cols-3">
          {timerType === 'for_time' || timerType === 'amrap'
            ? number('timeCapMinutes', t('admin.wod.timeCap'))
            : null}
          {timerType === 'emom' || timerType === 'tabata'
            ? number('rounds', t('admin.wod.rounds'))
            : null}
          {timerType === 'for_time' ? number('rounds', t('admin.wod.roundsOptional')) : null}
          {timerType === 'emom' ? number('intervalSeconds', t('admin.wod.interval')) : null}
          {timerType === 'tabata' ? number('workSeconds', t('admin.wod.work')) : null}
          {timerType === 'tabata' ? number('restSeconds', t('admin.wod.rest')) : null}
        </div>
      )}
      {scoreType === 'load' || guided ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label={scoreType === 'load' ? t('admin.wod.movement') : t('admin.wod.loadMovement')}
            error={invalid('movementId')}
            {...form.register(`${name}.movementId`)}
          >
            <option value="">{t('admin.wod.noMovement')}</option>
            {movements.map((movement) => (
              <option key={movement.id} value={movement.id}>
                {movement.name}
              </option>
            ))}
          </SelectField>
          {guided && movementId ? number('loadPercent', t('admin.wod.loadPercent')) : null}
        </div>
      ) : null}
      {guided ? <GuidedStepsEditor form={form} index={index} /> : null}
    </Card>
  );
}
