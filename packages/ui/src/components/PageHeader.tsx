import { classNames } from '../lib/class-names';

export interface PageHeaderProps {
  title: string;
  /** Small context line above the title, such as the app or box name. */
  eyebrow?: string;
  subtitle?: string;
  /** `large` on wide panels, `regular` on phone-sized screens. */
  size?: 'regular' | 'large';
}

/** The top of every screen: one clear title, so the hierarchy is the same everywhere. */
export function PageHeader({ title, eyebrow, subtitle, size = 'regular' }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-1">
      {eyebrow ? <span className="text-sm text-text-secondary">{eyebrow}</span> : null}
      <h1
        className={classNames('font-display font-bold', size === 'large' ? 'text-3xl' : 'text-2xl')}
      >
        {title}
      </h1>
      {subtitle ? <p className="mt-1 text-text-secondary">{subtitle}</p> : null}
    </header>
  );
}
