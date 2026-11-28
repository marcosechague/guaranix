import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { classNames } from '../lib/class-names';

/** Classes of one cell of a phone tab bar, for a link or a button. */
export function bottomBarTabClasses(active: boolean): string {
  return classNames(
    'flex min-h-16 w-full flex-col items-center justify-center gap-1 text-micro font-semibold',
    active ? 'text-text' : 'text-text-secondary',
  );
}

export interface BottomBarTabContentProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
}

/** Icon in a pill (lime when active) over a short label. */
export function BottomBarTabContent({ icon: Icon, label, active }: BottomBarTabContentProps) {
  return (
    <>
      <span
        className={classNames(
          'flex h-7 w-12 items-center justify-center rounded-pill',
          active && 'bg-accent text-on-accent',
        )}
      >
        <Icon aria-hidden="true" size={19} strokeWidth={1.75} />
      </span>
      {label}
    </>
  );
}

export interface BottomBarButtonProps
  extends BottomBarTabContentProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {}

/** A tab that opens something instead of navigating, like "Más". */
export function BottomBarButton({ icon, label, active, ...props }: BottomBarButtonProps) {
  return (
    <button type="button" className={bottomBarTabClasses(active)} {...props}>
      <BottomBarTabContent icon={icon} label={label} active={active} />
    </button>
  );
}
