import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { classNames } from '../lib/class-names';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  children: ReactNode;
  variant?: 'outline' | 'ghost';
}

export function IconButton({
  label,
  variant = 'outline',
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={classNames(
        'inline-flex size-touch shrink-0 items-center justify-center rounded-pill text-text',
        'transition-[transform,opacity] duration-fast ease-out active:scale-[0.94]',
        'disabled:pointer-events-none disabled:opacity-50',
        variant === 'outline' ? 'border border-border bg-surface' : 'hover:bg-surface',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
