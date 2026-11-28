import type { ButtonHTMLAttributes } from 'react';
import { classNames } from '../lib/class-names';

export interface TapAreaProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: what a tap does, since the content is only a display. */
  label: string;
}

/**
 * A large, borderless tap target that fills its space, for screens used
 * mid-workout (the guided WOD): a tap anywhere on it counts.
 */
export function TapArea({ label, className, ...props }: TapAreaProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={classNames(
        'flex touch-manipulation flex-col items-center justify-center gap-3 rounded-xl text-center select-none',
        'transition-press active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-accent',
        className,
      )}
      {...props}
    />
  );
}
