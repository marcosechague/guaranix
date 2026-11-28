import type { HTMLAttributes } from 'react';
import { classNames } from '../lib/class-names';

type CardElement = 'section' | 'article' | 'div' | 'li';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: CardElement;
  /** `compact` for short notices, `regular` for cards with several blocks inside. */
  spacing?: 'compact' | 'regular';
}

const spacingClasses = { compact: 'gap-2', regular: 'gap-4' } as const;

/** The raised surface every screen uses to group related content. */
export function Card({
  as: Element = 'section',
  spacing = 'regular',
  className,
  ...props
}: CardProps) {
  return (
    <Element
      className={classNames(
        'flex flex-col rounded-xl border border-border bg-surface p-5',
        spacingClasses[spacing],
        className,
      )}
      {...props}
    />
  );
}

/** Small uppercase label that opens a card ("TU PRÓXIMA CLASE"). */
export function Eyebrow({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={classNames(
        'text-xs font-semibold tracking-widest text-text-secondary uppercase',
        className,
      )}
      {...props}
    />
  );
}
