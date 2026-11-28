import { classNames } from '../lib/class-names';

export interface Option<T extends string> {
  value: T;
  label: string;
}

export interface OptionGroupProps<T extends string> {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className: string;
  optionClassName: (selected: boolean) => string;
}

/** Single choice shown as buttons, announced as a radio group. Styled by its wrappers. */
export function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
  optionClassName,
}: OptionGroupProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={className}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={classNames(
            'transition-[transform,opacity] duration-fast ease-out active:scale-95',
            optionClassName(option.value === value),
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
