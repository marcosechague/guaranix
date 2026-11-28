import type { HTMLAttributes, ReactNode } from 'react';
import { classNames } from '../lib/class-names';

export interface BottomBarProps extends HTMLAttributes<HTMLElement> {
  as?: 'nav' | 'footer';
}

/** Surface pinned to the bottom of the screen, above the device's home indicator. */
export function BottomBar({ as: Element = 'footer', className, ...props }: BottomBarProps) {
  return (
    <Element
      className={classNames(
        'fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-safe',
        className,
      )}
      {...props}
    />
  );
}

export interface ActionBarProps {
  /** Usually "Atrás" at the start and the main action at the end. */
  children: ReactNode;
}

/** Actions of a step-by-step flow, always within thumb reach. */
export function ActionBar({ children }: ActionBarProps) {
  return (
    <BottomBar>
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-6 py-3 md:px-8">
        {children}
      </div>
    </BottomBar>
  );
}
