import { t } from '@guaranix/shared';
import { FileText, ImageUp, X } from 'lucide-react';
import { useId, useRef } from 'react';
import { classNames } from '../lib/class-names';
import { IconButton } from './IconButton';

export interface FileFieldProps {
  label: string;
  /** What to pick, e.g. "Foto o PDF del comprobante". */
  prompt: string;
  /** `accept` of the input, e.g. `image/*,application/pdf`. */
  accept: string;
  value: File | null;
  onChange: (file: File | null) => void;
  hint?: string | undefined;
  error?: string | undefined;
}

const sizeText = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** One file, picked from the phone's gallery or camera, or from the computer. */
export function FileField({ label, prompt, accept, value, onChange, hint, error }: FileFieldProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  const Icon = value?.type === 'application/pdf' ? FileText : ImageUp;

  const clear = () => {
    onChange(null);
    if (input.current) input.current.value = '';
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-text-soft">{label}</span>
      <div
        className={classNames(
          'flex min-h-touch items-center gap-3 rounded-md border bg-surface px-3 py-2.5',
          'focus-within:border-accent',
          value ? '' : 'border-dashed',
          error ? 'border-warning' : 'border-border',
        )}
      >
        <label htmlFor={inputId} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
          <Icon
            aria-hidden="true"
            size={20}
            strokeWidth={1.75}
            className="shrink-0 text-text-secondary"
          />
          <span className="flex min-w-0 flex-col">
            <span className="sr-only">{label}: </span>
            <span className="truncate text-sm font-medium text-text">
              {value ? value.name : prompt}
            </span>
            <span className="text-xs text-text-secondary">
              {value ? sizeText(value.size) : t('common.chooseFile')}
            </span>
          </span>
        </label>
        {value ? (
          <IconButton variant="ghost" label={t('common.removeFile')} onClick={clear}>
            <X aria-hidden="true" size={18} />
          </IconButton>
        ) : null}
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={accept}
          className="sr-only"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        />
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-warning">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-text-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
