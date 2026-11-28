import { Upload } from 'lucide-react';
import { type DragEvent, useId, useState } from 'react';
import { classNames } from '../lib/class-names';
import { IconCircle } from './IconCircle';

export interface FileDropZoneProps {
  label: string;
  /** Second line, e.g. accepted formats. */
  hint?: string | undefined;
  /** Same syntax as the native `accept` attribute (".xlsx,.csv,image/*"). */
  accept?: string | undefined;
  disabled?: boolean | undefined;
  error?: string | undefined;
  onFile: (file: File) => void;
}

/**
 * Pick a file by tapping or by dropping it. The real control is a native file
 * input under a `label`, so it works with the keyboard and screen readers.
 */
export function FileDropZone({ label, hint, accept, disabled, error, onFile }: FileDropZoneProps) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && !disabled) onFile(file);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={classNames(
          'flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center',
          'transition-[border-color,background-color] duration-fast ease-out',
          'has-[:focus-visible]:border-accent',
          dragging ? 'border-accent bg-accent-soft' : error ? 'border-warning' : 'border-border',
          disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-surface-sunken',
        )}
      >
        <IconCircle icon={Upload} />
        <span className="font-semibold text-text">{label}</span>
        {hint ? (
          <span id={`${inputId}-hint`} className="text-sm text-text-secondary">
            {hint}
          </span>
        ) : null}
        <input
          id={inputId}
          type="file"
          accept={accept}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            // Picking the same file again should fire `onChange` again.
            event.target.value = '';
          }}
        />
      </label>
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-warning" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
