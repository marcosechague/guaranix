import { classNames } from '../lib/class-names';

export interface ColorDotProps {
  /** A program's color from the box settings (data, not a design token). */
  color: string | null;
  className?: string;
}

export function ColorDot({ color, className }: ColorDotProps) {
  return (
    <span
      aria-hidden="true"
      className={classNames('size-2 shrink-0 rounded-pill bg-text-secondary', className)}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}
