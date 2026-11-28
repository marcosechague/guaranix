import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { classNames } from '../lib/class-names';
import { Brodi } from './Brodi';

export interface EmptyStateProps {
  title: string;
  description: string;
  /** A call to action that tells the person what to do next. */
  action?: ReactNode;
  /** Brodi by default; pass a Lucide icon for quieter places. */
  icon?: LucideIcon;
  /** Draws its own bordered surface, for empty lists outside a Card. */
  framed?: boolean;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
  framed = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={classNames(
        'flex items-center gap-4',
        framed && 'rounded-xl border border-border bg-surface p-5',
        className,
      )}
    >
      <div className="shrink-0">
        {Icon ? (
          <span className="flex size-12 items-center justify-center rounded-pill bg-surface-sunken text-text-secondary">
            <Icon aria-hidden="true" size={22} />
          </span>
        ) : (
          <Brodi alt="" size={64} />
        )}
      </div>
      <div className="flex flex-col items-start gap-1.5">
        <p className="font-semibold text-text">{title}</p>
        <p className="text-sm text-text-secondary">{description}</p>
        {action ? <div className="pt-1.5">{action}</div> : null}
      </div>
    </div>
  );
}
