import { classNames } from '../lib/class-names';
import type { ChipOption } from './ChipGroup';
import { OptionGroup } from './OptionGroup';

export interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string | undefined;
}

/** Two or three mutually exclusive options in one pill ("Rx | Escalado"). */
export function SegmentedControl<T extends string>({
  className,
  ...props
}: SegmentedControlProps<T>) {
  return (
    <OptionGroup
      {...props}
      className={classNames(
        'inline-flex rounded-md border border-border bg-surface-sunken p-1',
        className,
      )}
      optionClassName={(selected) =>
        classNames(
          'min-h-9 flex-1 rounded-sm px-3 text-sm font-semibold',
          selected ? 'bg-accent text-on-accent' : 'text-text-secondary hover:text-text',
        )
      }
    />
  );
}
