import { parseGuidedSteps, t } from '@guaranix/shared';
import { Button, Card, IconButton, TextField } from '@guaranix/ui';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { type UseFormReturn, useFieldArray, useWatch } from 'react-hook-form';
import type { WorkoutFormValues } from './workout-form';

export interface GuidedStepsEditorProps {
  form: UseFormReturn<WorkoutFormValues>;
  index: number;
}

/**
 * Until the coach edits them, the steps are a preview read from the
 * description, so most WODs need nothing extra to be guided.
 */
export function GuidedStepsEditor({ form, index }: GuidedStepsEditorProps) {
  const name = `components.${index}.guidedSteps` as const;
  const steps = useFieldArray({ control: form.control, name });
  const description = useWatch({ control: form.control, name: `components.${index}.description` });
  const custom = steps.fields.length > 0;
  const parsed = custom ? [] : parseGuidedSteps(description);

  return (
    <Card variant="nested">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-display text-sm font-bold">{t('admin.wod.guided.title')}</h4>
          <p className="text-sm text-text-secondary">
            {custom ? t('admin.wod.guided.customHint') : t('admin.wod.guided.fromDescription')}
          </p>
        </div>
        {custom ? (
          <Button variant="ghost" type="button" onClick={() => steps.replace([])}>
            <RotateCcw aria-hidden="true" size={16} />
            {t('admin.wod.guided.reset')}
          </Button>
        ) : (
          <Button
            variant="secondary"
            type="button"
            onClick={() => steps.replace(parsed.length > 0 ? parsed : [{ quantity: '', name: '' }])}
          >
            {t('admin.wod.guided.edit')}
          </Button>
        )}
      </div>
      {custom ? (
        <ol className="flex flex-col gap-2">
          {steps.fields.map((field, stepIndex) => (
            <li key={field.id} className="flex items-end gap-2">
              <TextField
                className="w-20 shrink-0 sm:w-24"
                label={t('admin.wod.guided.quantity')}
                labelClassName={stepIndex > 0 ? 'sr-only' : undefined}
                {...form.register(`${name}.${stepIndex}.quantity`)}
              />
              <TextField
                className="min-w-0 flex-1"
                label={t('admin.wod.guided.movement')}
                labelClassName={stepIndex > 0 ? 'sr-only' : undefined}
                {...form.register(`${name}.${stepIndex}.name`)}
              />
              <IconButton
                variant="ghost"
                label={t('admin.wod.guided.removeStep')}
                onClick={() => steps.remove(stepIndex)}
              >
                <Trash2 aria-hidden="true" size={18} />
              </IconButton>
            </li>
          ))}
          <li>
            <Button
              variant="ghost"
              type="button"
              onClick={() => steps.append({ quantity: '', name: '' })}
            >
              <Plus aria-hidden="true" size={16} />
              {t('admin.wod.guided.addStep')}
            </Button>
          </li>
        </ol>
      ) : parsed.length > 0 ? (
        <ol className="flex flex-wrap gap-1.5" aria-label={t('admin.wod.guided.preview')}>
          {parsed.map((step, stepIndex) => (
            <li
              key={`${stepIndex}-${step.name}`}
              className="rounded-md bg-surface-sunken px-2 py-1 text-sm"
            >
              <span className="font-semibold tabular-nums">{step.quantity}</span> {step.name}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-text-secondary">{t('admin.wod.guided.noSteps')}</p>
      )}
    </Card>
  );
}
