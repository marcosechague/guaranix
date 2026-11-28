import type { HTMLAttributes } from 'react';
import { classNames } from '../lib/class-names';

export interface DividedListProps extends HTMLAttributes<HTMLElement> {
  as?: 'ul' | 'ol';
}

/** Rows separated by hairlines on a raised surface: rankings, member lists. */
export function DividedList({ as: Element = 'ul', className, ...props }: DividedListProps) {
  return (
    <Element
      className={classNames(
        'flex flex-col divide-y divide-divider rounded-xl border border-border bg-surface',
        className,
      )}
      {...props}
    />
  );
}
