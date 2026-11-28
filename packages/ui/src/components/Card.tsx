import type { HTMLAttributes } from 'react';
import { classNames } from '../lib/class-names';

type CardElement = 'section' | 'article' | 'div' | 'li';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: CardElement;
  /** `compact` for short notices, `regular` for cards with several blocks inside. */
  spacing?: 'compact' | 'regular';
  /** `nested`: a lighter frame for a group of fields inside another card. */
  variant?: 'raised' | 'nested';
}

const spacingClasses = { compact: 'gap-2', regular: 'gap-4' } as const;
const variantClasses = {
  raised: 'rounded-xl border border-border bg-surface p-5',
  nested: 'gap-3 rounded-lg border border-border p-4',
} as const;

/** The raised surface every screen uses to group related content. */
export function Card({
  as: Element = 'section',
  spacing = 'regular',
  variant = 'raised',
  className,
  ...props
}: CardProps) {
  return (
    <Element
      className={classNames(
        'flex flex-col',
        variant === 'raised' ? spacingClasses[spacing] : null,
        variantClasses[variant],
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
