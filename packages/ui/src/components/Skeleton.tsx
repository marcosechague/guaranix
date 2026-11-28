import { classNames } from '../lib/class-names';

/** Placeholder block while data loads; the parent sets `aria-busy`. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={classNames(
        'animate-pulse rounded-md bg-surface-sunken motion-reduce:animate-none',
        className,
      )}
    />
  );
}
