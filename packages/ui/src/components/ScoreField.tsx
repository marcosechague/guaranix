import { type InputHTMLAttributes, useId } from 'react';
import { classNames } from '../lib/class-names';
import { fieldControlClasses } from './field-control';

export interface ScoreFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}

/** Big, thumb-friendly input for a WOD score ("9:42", "120"). */
export function ScoreField({
  label,
  value,
  onChange,
  invalid = false,
  className,
  ...props
}: ScoreFieldProps) {
  const id = useId();
  return (
    <div className={classNames('flex min-w-0 flex-1 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium text-text-secondary">
        {label}
      </label>
      <input
        id={id}
        value={value}
        autoComplete="off"
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
        className={fieldControlClasses(
          Boolean(invalid),
          'min-h-14 w-full bg-surface-sunken px-4 font-display text-3xl font-bold tabular-nums',
        )}
        {...props}
      />
    </div>
  );
}
