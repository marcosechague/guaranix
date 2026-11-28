import type { ReactNode } from 'react';
import { classNames } from '../lib/class-names';

export interface StatTileProps {
  value: ReactNode;
  label: string;
  hint?: string;
  className?: string;
}

/** Big number with a short label underneath ("12 · días de racha"). */
export function StatTile({ value, label, hint, className }: StatTileProps) {
  return (
    <div
      className={classNames(
        'flex flex-col gap-1 rounded-xl border border-border bg-surface p-4',
        className,
      )}
    >
      <span className="font-display text-3xl leading-none font-bold tabular-nums">{value}</span>
      <span className="text-xs text-text-secondary">{label}</span>
      {hint ? <span className="text-xs text-text-soft">{hint}</span> : null}
    </div>
  );
}
