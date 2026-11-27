import type { ReactNode } from 'react';
import { classNames } from '../lib/class-names';

export interface FormMessageProps {
  tone: 'error' | 'success';
  children: ReactNode;
}

/** Inline result of a form submit, announced to screen readers. */
export function FormMessage({ tone, children }: FormMessageProps) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={classNames(
        'rounded-md px-3 py-2.5 text-sm',
        tone === 'error' ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success',
      )}
    >
      {children}
    </p>
  );
}
