import { type InputHTMLAttributes, type Ref, useId } from 'react';
import { classNames } from '../lib/class-names';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | undefined;
  ref?: Ref<HTMLInputElement>;
  /** E.g. `md:sr-only` on repeated rows, where a header row already names the column. */
  labelClassName?: string | undefined;
}

export function TextField({
  label,
  hint,
  error,
  className,
  labelClassName,
  id,
  ref,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className={classNames('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={inputId}
        className={classNames('text-sm font-medium text-text-soft', labelClassName)}
      >
        {label}
      </label>
      <input
        id={inputId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={classNames(
          'min-h-touch rounded-md border bg-surface px-3 text-base text-text',
          'transition-[border-color] duration-fast ease-out outline-none',
          'placeholder:text-text-secondary focus-visible:border-accent',
          error ? 'border-warning' : 'border-border',
        )}
        {...props}
      />
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
