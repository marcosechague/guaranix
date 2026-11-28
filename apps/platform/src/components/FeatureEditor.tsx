import { t } from '@guaranix/shared';
import { Button, Card, FormMessage, TextField } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import type { ReactNode } from 'react';

export interface FeatureEditorProps {
  /** What is being decided: the on/off switch or the override choice. */
  children: ReactNode;
  limitLabel: string;
  limitHint: string;
  limit: string;
  onLimitChange: (value: string) => void;
  limitDisabled: boolean;
  invalid: boolean;
  error: unknown;
  pending: boolean;
  onSave: () => Promise<void>;
}

/** One paid feature with its monthly limit and its own save, for plans and for boxes. */
export function FeatureEditor({
  children,
  limitLabel,
  limitHint,
  limit,
  onLimitChange,
  limitDisabled,
  invalid,
  error,
  pending,
  onSave,
}: FeatureEditorProps) {
  return (
    <Card as="div" variant="nested">
      {children}
      <TextField
        label={limitLabel}
        hint={limitHint}
        type="number"
        inputMode="numeric"
        min={0}
        value={limit}
        disabled={limitDisabled}
        error={invalid ? t('platform.features.invalidLimit') : undefined}
        onChange={(event) => onLimitChange(event.target.value)}
      />
      {error ? <FormMessage tone="error">{errorText(error)}</FormMessage> : null}
      <Button
        variant="secondary"
        className="self-start"
        disabled={pending}
        onClick={() => void onSave().catch(() => undefined)}
      >
        {t('platform.features.save')}
      </Button>
    </Card>
  );
}
