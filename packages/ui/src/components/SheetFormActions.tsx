import { t } from '@guaranix/shared';
import { Button } from './Button';

export interface SheetFormActionsProps {
  /** The `id` of the form inside the sheet; the submit button lives in the sheet footer. */
  formId: string;
  pending: boolean;
  onCancel: () => void;
}

/** Cancel and save, side by side, for a sheet that holds a form. */
export function SheetFormActions({ formId, pending, onCancel }: SheetFormActionsProps) {
  return (
    <>
      <Button variant="secondary" className="flex-1" onClick={onCancel}>
        {t('common.cancel')}
      </Button>
      <Button type="submit" form={formId} className="flex-1" disabled={pending}>
        {pending ? t('common.saving') : t('common.save')}
      </Button>
    </>
  );
}
