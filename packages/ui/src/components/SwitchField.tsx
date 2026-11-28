import { useId } from 'react';
import { classNames } from '../lib/class-names';

export interface SwitchFieldProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/** On/off setting with its explanation; the whole row is the touch target. */
export function SwitchField({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  className,
}: SwitchFieldProps) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-label`}
      {...(description ? { 'aria-describedby': `${id}-description` } : {})}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={classNames(
        'flex min-h-touch w-full items-center justify-between gap-4 rounded-md border border-border bg-surface px-4 py-3 text-left',
        'transition-press active:scale-[0.99] disabled:opacity-50',
        className,
      )}
    >
      <span className="flex flex-col gap-0.5">
        <span id={`${id}-label`} className="text-sm font-semibold text-text">
          {label}
        </span>
        {description ? (
          <span id={`${id}-description`} className="text-sm text-text-secondary">
            {description}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className={classNames(
          'relative h-7 w-12 shrink-0 rounded-pill transition-[background-color] duration-fast ease-out',
          checked ? 'bg-accent' : 'bg-surface-sunken',
        )}
      >
        <span
          className={classNames(
            'absolute top-1 left-1 size-5 rounded-pill bg-text shadow transition-transform duration-fast ease-out',
            checked ? 'translate-x-5 bg-on-accent' : '',
          )}
        />
      </span>
    </button>
  );
}
