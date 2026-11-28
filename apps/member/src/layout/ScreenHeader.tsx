import type { ReactNode } from 'react';

export interface ScreenHeaderProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  action?: ReactNode;
}

export function ScreenHeader({ title, eyebrow, subtitle, action }: ScreenHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4 px-5 pt-7 pb-5">
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow ? (
          <span className="text-xs font-semibold tracking-[0.12em] text-text-secondary uppercase">
            {eyebrow}
          </span>
        ) : null}
        <h1 className="font-display text-3xl leading-tight font-bold">{title}</h1>
        {subtitle ? <p className="text-sm text-text-secondary">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}
