import type { ButtonHTMLAttributes } from 'react';
import { classNames } from '../lib/class-names';

export interface TileButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `selected` keeps the accent border, for toggles such as attendance. */
  selected?: boolean;
}

/** A small tappable surface: a class in the week grid, a member in a roster. */
export function TileButton({ selected = false, className, ...props }: TileButtonProps) {
  return (
    <button
      type="button"
      className={classNames(
        'flex w-full min-w-0 flex-col gap-2 rounded-lg border bg-surface p-3 text-left',
        'transition-press hover:border-text-secondary disabled:pointer-events-none disabled:opacity-50',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong',
        selected ? 'border-accent-strong' : 'border-border',
        className,
      )}
      {...props}
    />
  );
}
