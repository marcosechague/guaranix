import type { ReactNode } from 'react';
import { classNames } from '../lib/class-names';

/**
 * - `mobile`: the member app, a single column sized for phones.
 * - `panel`: admin and platform, wide and responsive.
 * - `centered`: one short message or form in the middle of the screen.
 */
export type PageLayout = 'mobile' | 'panel' | 'centered';

export interface PageProps {
  layout: PageLayout;
  children: ReactNode;
  className?: string;
}

const layoutClasses: Record<PageLayout, string> = {
  mobile: 'max-w-md gap-5 px-5 pt-7 pb-4',
  panel: 'max-w-6xl gap-6 px-6 py-8 md:px-8',
  centered: 'max-w-md justify-center gap-5 px-5 py-8',
};

/** Outer frame of a screen, so the three apps share widths and margins. */
export function Page({ layout, children, className }: PageProps) {
  return (
    <main
      className={classNames(
        'mx-auto flex min-h-dvh w-full flex-col',
        layoutClasses[layout],
        className,
      )}
    >
      {children}
    </main>
  );
}
