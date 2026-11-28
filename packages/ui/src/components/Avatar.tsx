import { classNames } from '../lib/class-names';

export interface AvatarProps {
  firstName: string;
  lastName: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Initials on a soft surface; photos come later with R2. */
export function Avatar({ firstName, lastName, size = 'md', className }: AvatarProps) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={classNames(
        'inline-flex shrink-0 items-center justify-center rounded-pill bg-surface-sunken font-display font-bold text-text-soft',
        size === 'sm' ? 'size-8 text-xs' : 'size-10 text-sm',
        className,
      )}
    >
      {initials}
    </span>
  );
}
