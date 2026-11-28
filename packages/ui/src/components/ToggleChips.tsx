import { classNames } from '../lib/class-names';
import type { Option } from './OptionGroup';

export interface ToggleChipOption<T extends string | number> extends Omit<Option<string>, 'value'> {
  value: T;
  /** Spoken name when the visible label is short ("L" → "Lunes"). */
  ariaLabel?: string;
}

export interface ToggleChipsProps<T extends string | number> {
  label: string;
  options: readonly ToggleChipOption<T>[];
  value: readonly T[];
  onChange: (value: T[]) => void;
  className?: string | undefined;
}

/** Several-of-many choice as square chips, such as the weekdays a class repeats on. */
export function ToggleChips<T extends string | number>({
  label,
  options,
  value,
  onChange,
  className,
}: ToggleChipsProps<T>) {
  const toggle = (option: T) =>
    onChange(
      value.includes(option)
        ? value.filter((item) => item !== option)
        : options
            .map((item) => item.value)
            .filter((item) => item === option || value.includes(item)),
    );
  return (
    <div role="group" aria-label={label} className={classNames('flex gap-1', className)}>
      {options.map((option) => {
        const selected = value.includes(option.value);
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={selected}
            aria-label={option.ariaLabel}
            onClick={() => toggle(option.value)}
            className={classNames(
              'flex min-h-touch min-w-9 flex-1 items-center justify-center rounded-md border text-sm font-semibold',
              'transition-press active:scale-95',
              selected
                ? 'border-accent bg-accent text-on-accent'
                : 'border-border bg-surface text-text-secondary hover:text-text',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
