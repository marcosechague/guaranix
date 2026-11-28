import type { ReactNode } from 'react';
import { classNames } from '../lib/class-names';

export interface PageHeaderProps {
  title: string;
  /** Small context line above the title, such as the app or box name. */
  eyebrow?: string | undefined;
  /** A line of text, or a short row such as a status badge with dates. */
  subtitle?: ReactNode;
  /** `large` on wide panels, `regular` on phone-sized screens. */
  size?: 'regular' | 'large';
  /** Buttons or an avatar aligned with the title (end on wide screens). */
  actions?: ReactNode;
}

/** The top of every screen: one clear title, so the hierarchy is the same everywhere. */
export function PageHeader({
  title,
  eyebrow,
  subtitle,
  size = 'regular',
  actions,
}: PageHeaderProps) {
  const heading = (
    <div className="flex min-w-0 flex-col gap-1">
      {eyebrow ? <span className="truncate text-sm text-text-secondary">{eyebrow}</span> : null}
      <h1
        className={classNames(
          'font-display font-bold tracking-tight',
          size === 'large' ? 'text-3xl' : 'text-2xl',
        )}
      >
        {title}
      </h1>
      {subtitle ? <div className="mt-1 text-text-secondary">{subtitle}</div> : null}
    </div>
  );
  if (!actions) return <header>{heading}</header>;
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      {heading}
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </header>
  );
}
