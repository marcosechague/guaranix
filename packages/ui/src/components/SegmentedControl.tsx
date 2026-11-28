import { classNames } from '../lib/class-names';
import type { ChipOption } from './ChipGroup';

export interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** Two or three mutually exclusive options in one pill ("Rx | Esc."). */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={classNames(
        'inline-flex rounded-md border border-border bg-surface-sunken p-1',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={classNames(
              'min-h-9 flex-1 rounded-sm px-3 text-sm font-semibold',
              'transition-[transform,opacity] duration-fast ease-out active:scale-[0.96]',
              selected ? 'bg-accent text-on-accent' : 'text-text-secondary hover:text-text',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
