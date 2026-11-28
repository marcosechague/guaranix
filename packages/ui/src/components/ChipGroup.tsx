import { classNames } from '../lib/class-names';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

export interface ChipGroupProps<T extends string> {
  label: string;
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** Single-choice filter pills ("Todos · CrossFit · Open Box"). */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: ChipGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={classNames('flex gap-2 overflow-x-auto', className)}
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
              'min-h-10 shrink-0 rounded-pill border px-4 text-sm font-semibold',
              'transition-[transform,opacity] duration-fast ease-out active:scale-[0.96]',
              selected
                ? 'border-text bg-text text-background'
                : 'border-border bg-surface text-text-soft hover:text-text',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
