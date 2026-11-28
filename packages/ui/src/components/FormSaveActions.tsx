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
  /** Defaults to "Guardar"; name what is saved when the form shares a screen with another one. */
  label?: string;
}

/** The end of a settings form: the save error, if any, and a Save button that waits for changes. */
export function FormSaveActions({ editable, dirty, pending, error, label }: FormSaveActionsProps) {
  return (
    <>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      {editable ? (
        <Button type="submit" className="self-end" disabled={!dirty || pending}>
          {pending ? t('common.saving') : (label ?? t('common.save'))}
        </Button>
      ) : null}
    </>
  );
}
