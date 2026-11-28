import { type Ref, type SelectHTMLAttributes, useId } from 'react';
import { classNames } from '../lib/class-names';
import { fieldControlClasses } from './field-control';

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string | undefined;
  ref?: Ref<HTMLSelectElement>;
}

export function SelectField({
  label,
  error,
  className,
  id,
  ref,
  children,
  ...props
}: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <div className={classNames('flex flex-col gap-1.5', className)}>
      <label htmlFor={selectId} className="text-sm font-medium text-text-soft">
        {label}
      </label>
      <select
        id={selectId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${selectId}-error` : undefined}
        className={fieldControlClasses(Boolean(error), 'min-h-touch bg-surface px-3 text-base')}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p id={`${selectId}-error`} className="text-sm text-warning">
          {error}
        </p>
      ) : null}
    </div>
  );
}
