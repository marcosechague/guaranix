import { Slot } from '@radix-ui/react-slot';
import type { ButtonHTMLAttributes } from 'react';
import { classNames } from '../lib/class-names';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Render the child element (e.g. a router link) with button styles. */
  asChild?: boolean;
}

const baseClasses =
  'inline-flex min-h-touch items-center justify-center gap-2 rounded-md px-4 font-semibold ' +
  'transition-[transform,opacity] duration-fast ease-out active:scale-[0.97] ' +
  'disabled:pointer-events-none disabled:opacity-50';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'border border-border bg-surface text-text hover:bg-surface-sunken',
  ghost: 'text-text hover:bg-surface',
};

export function Button({ variant = 'primary', asChild = false, className, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component className={classNames(baseClasses, variantClasses[variant], className)} {...props} />
  );
}
