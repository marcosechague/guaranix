import { classNames } from '../lib/class-names';

/**
 * Border, focus and error look shared by every text-like control (input,
 * select, textarea, score). Focus uses `accent-strong`: plain lime is invisible
 * on the light theme's white fields.
 */
export function fieldControlClasses(invalid: boolean, ...extra: Array<string | false | undefined>) {
  return classNames(
    'rounded-md border text-text outline-none placeholder:text-text-secondary',
    'transition-[border-color] duration-fast ease-out',
    'focus-visible:border-accent-strong focus-visible:ring-1 focus-visible:ring-accent-strong',
    invalid ? 'border-warning' : 'border-border',
    ...extra,
  );
}
