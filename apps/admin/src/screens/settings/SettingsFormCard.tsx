import { t } from '@guaranix/shared';
import { Card, FormSaveActions } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import type { FormEventHandler, ReactNode } from 'react';

export interface SettingsFormCardProps {
  title: string;
  hint: string;
  editable: boolean;
  dirty: boolean;
  pending: boolean;
  error: unknown;
  onSubmit: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
}

/** A section of Ajustes saved as a whole; read-only staff see why they can't change it. */
export function SettingsFormCard({
  title,
  hint,
  editable,
  dirty,
  pending,
  error,
  onSubmit,
  children,
}: SettingsFormCardProps) {
  return (
    <Card as="section">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <p className="text-sm text-text-secondary">
          {editable ? hint : t('admin.settings.readOnly')}
        </p>
      </div>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {children}
        <FormSaveActions
          editable={editable}
          dirty={dirty}
          pending={pending}
          error={error ? errorText(error) : null}
        />
      </form>
    </Card>
  );
}
