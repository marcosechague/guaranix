import { t } from '@guaranix/shared';
import type { ClassSchedule } from '@guaranix/shared/api';
import { FormMessage, Sheet, SheetFormActions, TextField, useToast } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { useState } from 'react';
import { useUpdateScheduleCapacity } from '../../api/mutations';

export interface ScheduleCapacitySheetProps {
  schedule: ClassSchedule;
  title: string;
  onClose: () => void;
}

const MIN_CAPACITY = 1;
const MAX_CAPACITY = 200;

export function ScheduleCapacitySheet({ schedule, title, onClose }: ScheduleCapacitySheetProps) {
  const [value, setValue] = useState(String(schedule.capacity));
  const update = useUpdateScheduleCapacity(schedule.id);
  const toast = useToast();
  const capacity = Number(value);
  const valid = Number.isInteger(capacity) && capacity >= MIN_CAPACITY && capacity <= MAX_CAPACITY;

  const save = () =>
    update.mutate(capacity, {
      onSuccess: (result) => {
        toast.show(t('admin.settings.capacitySaved', { count: result.updatedClasses }));
        onClose();
      },
    });

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      description={t('admin.settings.schedulesHint')}
      closeLabel={t('common.close')}
      footer={
        <SheetFormActions
          onSubmit={save}
          pending={update.isPending}
          disabled={!valid}
          onCancel={onClose}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label={t('admin.settings.capacity')}
          inputMode="numeric"
          value={value}
          error={valid ? undefined : t('errors.invalid_input')}
          onChange={(event) => setValue(event.target.value)}
        />
        {update.isError ? <FormMessage tone="error">{errorText(update.error)}</FormMessage> : null}
      </div>
    </Sheet>
  );
}
