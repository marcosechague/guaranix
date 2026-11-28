import { t } from '@guaranix/shared';
import { Sheet, SheetFormActions, TextField } from '@guaranix/ui';
import { type FormEvent, useId, useState } from 'react';

export interface ProposalRowSheetProps<Field extends string> {
  row: number;
  fields: readonly Field[];
  labelOf: (field: Field) => string;
  cells: string[];
  onSave: (cells: string[]) => void;
  onClose: () => void;
}

/** Every import field as a text box: the API validates dates and amounts as it does for a sheet. */
export function ProposalRowSheet<Field extends string>({
  row,
  fields,
  labelOf,
  cells,
  onSave,
  onClose,
}: ProposalRowSheetProps<Field>) {
  const formId = useId();
  const [values, setValues] = useState(() => fields.map((_, column) => cells[column] ?? ''));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave(values.map((value) => value.trim()));
  };

  return (
    <Sheet
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t('admin.imports.ai.editTitle', { row })}
      description={t('admin.imports.ai.editHint')}
      closeLabel={t('common.close')}
      footer={<SheetFormActions formId={formId} pending={false} onCancel={onClose} />}
    >
      <form id={formId} className="flex flex-col gap-4" onSubmit={submit}>
        {fields.map((field, column) => (
          <TextField
            key={field}
            label={labelOf(field)}
            value={values[column] ?? ''}
            maxLength={2000}
            onChange={(event) => {
              const next = [...values];
              next[column] = event.target.value;
              setValues(next);
            }}
          />
        ))}
      </form>
    </Sheet>
  );
}
