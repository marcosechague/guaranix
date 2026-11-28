import { classNames } from '../lib/class-names';
import { type Option, OptionGroup } from './OptionGroup';

export type ChipOption<T extends string> = Option<T>;

export interface ChipGroupProps<T extends string> {
  label: string;
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string | undefined;
}

/** Single-choice filter pills ("Todos · CrossFit · Open Box"). */
export function ChipGroup<T extends string>({ className, ...props }: ChipGroupProps<T>) {
  return (
    <OptionGroup
      {...props}
      className={classNames('flex gap-2 overflow-x-auto', className)}
      optionClassName={(selected) =>
        classNames(
          'min-h-touch shrink-0 rounded-pill border px-4 text-sm font-semibold',
          selected
            ? 'border-text bg-text text-background'
            : 'border-border bg-surface text-text-soft hover:text-text',
        )
      }
    />
  );
}
