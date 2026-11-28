import { t } from '@guaranix/shared';
import type { Workout } from '@guaranix/shared/api';
import { Badge, Button, Card, FormMessage, TextAreaField, TextField, useToast } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { Plus } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useSaveWorkout, useSetWorkoutPublished } from '../../api/mutations';
import { useMovements } from '../../api/queries';
import { ComponentEditor } from './ComponentEditor';
import {
  blankComponent,
  formFieldOf,
  toFormValues,
  toWorkoutInput,
  type WorkoutFormValues,
} from './workout-form';

export interface WorkoutEditorProps {
  workout: Workout | undefined;
  programId: string;
  workoutDate: string;
}

export function WorkoutEditor({ workout, programId, workoutDate }: WorkoutEditorProps) {
  const form = useForm<WorkoutFormValues>({ defaultValues: toFormValues(workout) });
  const components = useFieldArray({ control: form.control, name: 'components' });
  const movements = useMovements();
  const save = useSaveWorkout(workout?.id ?? null);
  const publish = useSetWorkoutPublished();
  const toast = useToast();
  const published = workout?.publishedAt != null;
  const busy = save.isPending || publish.isPending;

  const submit = (andPublish: boolean) =>
    form.handleSubmit((values) => {
      form.clearErrors();
      const parsed = toWorkoutInput(values, { programId, workoutDate });
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const field = formFieldOf(issue.path);
          if (field) form.setError(field as 'title', { message: issue.message });
        }
        return;
      }
      save.mutate(parsed.data, {
        onSuccess: (saved) => {
          form.reset(toFormValues(saved));
          if (!andPublish) return toast.show(t('admin.wod.saved'));
          publish.mutate(
            { workoutId: saved.id, published: true },
            { onSuccess: () => toast.show(t('admin.wod.publishedToast')) },
          );
        },
      });
    })();

  const unpublish = () =>
    workout &&
    publish.mutate(
      { workoutId: workout.id, published: false },
      { onSuccess: () => toast.show(t('admin.wod.unpublishedToast')) },
    );

  const mutationError = save.error ?? publish.error;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit(false);
      }}
      className="flex flex-col gap-5"
    >
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge tone={published ? 'success' : 'neutral'} dot>
            {published ? t('admin.wod.published') : t('admin.wod.draft')}
          </Badge>
          <p className="text-sm text-text-secondary">
            {published ? t('admin.wod.isPublished') : t('admin.wod.notPublished')}
          </p>
        </div>
        <TextField label={t('admin.wod.workoutTitle')} {...form.register('title')} />
        <TextAreaField
          label={t('admin.wod.coachNotes')}
          rows={3}
          {...form.register('coachNotes')}
        />
      </Card>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold">{t('admin.wod.components')}</h2>
        <p className="text-sm text-text-secondary">{t('admin.wod.componentsHint')}</p>
      </div>
      <ol className="flex flex-col gap-4">
        {components.fields.map((field, index) => (
          <ComponentEditor
            key={field.id}
            form={form}
            index={index}
            count={components.fields.length}
            movements={movements.data ?? []}
            onMove={(to) => components.move(index, to)}
            onRemove={() => components.remove(index)}
          />
        ))}
      </ol>
      <Button
        variant="secondary"
        className="self-start"
        disabled={components.fields.length >= 20}
        onClick={() => components.append(blankComponent('metcon'))}
      >
        <Plus aria-hidden="true" size={18} />
        {t('admin.wod.addComponent')}
      </Button>
      {mutationError ? <FormMessage tone="error">{errorText(mutationError)}</FormMessage> : null}
      <div className="sticky bottom-tabbar z-10 -mx-1 flex flex-wrap justify-end gap-3 rounded-xl border border-border bg-surface p-3 md:bottom-4">
        {published ? (
          <Button variant="secondary" disabled={busy} onClick={unpublish}>
            {t('admin.wod.unpublish')}
          </Button>
        ) : null}
        <Button type="submit" variant={published ? 'primary' : 'secondary'} disabled={busy}>
          {save.isPending ? t('common.saving') : published ? t('common.save') : t('admin.wod.save')}
        </Button>
        {published ? null : (
          <Button disabled={busy} onClick={() => void submit(true)}>
            {t('admin.wod.publish')}
          </Button>
        )}
      </div>
    </form>
  );
}
