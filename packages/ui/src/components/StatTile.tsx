import type { ReactNode } from 'react';
import { classNames } from '../lib/class-names';

export interface StatTileProps {
  value: ReactNode;
  label: string;
  hint?: ReactNode;
  /** `md` for long values such as amounts in guaraníes. */
  size?: 'md' | 'lg';
  /** Puts the label above the value, as in panel KPIs. */
  labelFirst?: boolean;
  className?: string;
}

/** Big number with a short label ("12 · días de racha"). */
export function StatTile({
  value,
  label,
  hint,
  size = 'lg',
  labelFirst = false,
  className,
}: StatTileProps) {
  return (
    <div
      className={classNames(
        'flex flex-col gap-1 rounded-xl border border-border bg-surface p-4',
        labelFirst && 'gap-2 p-5',
        className,
      )}
    >
      <span
        className={classNames(
          'font-display leading-none font-bold whitespace-nowrap tabular-nums',
          size === 'lg' ? 'text-3xl' : 'text-xl sm:text-2xl',
          labelFirst && 'order-2',
        )}
      >
        {value}
      </span>
      <span className={classNames('text-xs text-text-secondary', labelFirst && 'order-1 text-sm')}>
        {label}
      </span>
      {hint ? <span className="order-3 text-xs text-text-secondary">{hint}</span> : null}
    </div>
  );
}
