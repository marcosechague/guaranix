import type { ReactNode } from 'react';
import { classNames } from '../lib/class-names';
import { Brodi } from './Brodi';

export interface EmptyStateProps {
  title: string;
  description: string;
  /** A call to action that tells the person what to do next. */
  action?: ReactNode;
  /** Brodi by default; pass a small Lucide icon for quieter places. */
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div className={classNames('flex items-center gap-4', className)}>
      <div className="shrink-0">{icon ?? <Brodi alt="" size={64} />}</div>
      <div className="flex flex-col items-start gap-1.5">
        <p className="font-semibold text-text">{title}</p>
        <p className="text-sm text-text-secondary">{description}</p>
        {action ? <div className="pt-1.5">{action}</div> : null}
      </div>
    </div>
  );
}
