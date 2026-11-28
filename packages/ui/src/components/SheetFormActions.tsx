import { t } from '@guaranix/shared';
import { Button } from './Button';

export interface SheetFormActionsProps {
  /** The `id` of a form inside the sheet, or `onSubmit` when there is no form element. */
  formId?: string;
  onSubmit?: () => void;
  pending: boolean;
  disabled?: boolean;
  onCancel: () => void;
  /** Defaults to "Guardar". */
  submitLabel?: string;
}

/** Cancel and save, side by side, for a sheet that holds a form. */
export function SheetFormActions({
  formId,
  onSubmit,
  pending,
  disabled = false,
  onCancel,
  submitLabel,
}: SheetFormActionsProps) {
  return (
    <>
      <Button variant="secondary" className="flex-1" onClick={onCancel}>
        {t('common.cancel')}
      </Button>
      <Button
        type={formId ? 'submit' : 'button'}
        form={formId}
        onClick={onSubmit}
        className="flex-1"
        disabled={pending || disabled}
      >
        {pending ? t('common.saving') : (submitLabel ?? t('common.save'))}
      </Button>
    </>
  );
}
