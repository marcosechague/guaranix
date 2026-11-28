import { t } from '@guaranix/shared';
import { Button } from './Button';
import { FormMessage } from './FormMessage';

export interface FormSaveActionsProps {
  /** Read-only viewers get no button. */
  editable: boolean;
  dirty: boolean;
  pending: boolean;
  /** Already translated, e.g. `errorText(mutation.error)`. */
  error: string | null;
}

/** The end of a settings form: the save error, if any, and a Save button that waits for changes. */
export function FormSaveActions({ editable, dirty, pending, error }: FormSaveActionsProps) {
  return (
    <>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      {editable ? (
        <Button type="submit" className="self-end" disabled={!dirty || pending}>
          {pending ? t('common.saving') : t('common.save')}
        </Button>
      ) : null}
    </>
  );
}
