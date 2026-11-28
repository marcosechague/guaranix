import type { HTMLAttributes } from 'react';
import { classNames } from '../lib/class-names';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'outline';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-text-soft',
  accent: 'bg-accent text-on-accent',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  outline: 'border border-border text-text-soft',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Shows a small status dot before the text. */
  dot?: boolean;
}

export function Badge({
  tone = 'neutral',
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span aria-hidden="true" className="size-1.5 rounded-pill bg-current" /> : null}
      {children}
    </span>
  );
}
