import { type Ref, type TextareaHTMLAttributes, useId } from 'react';
import { classNames } from '../lib/class-names';
import { fieldControlClasses } from './field-control';

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
        className={fieldControlClasses(Boolean(error), 'min-h-24 bg-surface px-3 py-2.5 text-base')}
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
