import { classNames } from '../lib/class-names';

export interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  className?: string;
  tone?: 'accent' | 'warning' | 'success';
}

const fills = { accent: 'bg-accent-strong', warning: 'bg-warning', success: 'bg-success' } as const;

/** Fills with `transform: scaleX` so it animates without layout work. */
export function ProgressBar({ value, max, label, className, tone = 'accent' }: ProgressBarProps) {
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={classNames('h-1.5 overflow-hidden rounded-pill bg-border', className)}
    >
      <div
        className={classNames(
          'h-full origin-left rounded-pill transition-transform duration-slow ease-out',
          fills[tone],
        )}
        style={{ transform: `scaleX(${ratio})` }}
      />
    </div>
  );
}
