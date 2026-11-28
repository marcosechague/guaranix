import { type Ref, type TextareaHTMLAttributes, useId } from 'react';
import { classNames } from '../lib/class-names';

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string | undefined;
  ref?: Ref<HTMLTextAreaElement>;
}

export function TextAreaField({ label, error, className, id, ref, ...props }: TextAreaFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className={classNames('flex flex-col gap-1.5', className)}>
      <label htmlFor={fieldId} className="text-sm font-medium text-text-soft">
        {label}
      </label>
      <textarea
        id={fieldId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={classNames(
          'min-h-24 rounded-md border bg-surface px-3 py-2.5 text-base text-text outline-none',
          'placeholder:text-text-secondary focus-visible:border-accent',
          error ? 'border-warning' : 'border-border',
        )}
        {...props}
      />
      {error ? (
        <p id={`${fieldId}-error`} className="text-sm text-warning">
          {error}
        </p>
      ) : null}
    </div>
  );
}
