import { t } from '@guaranix/shared';
import { BoxMark, classNames } from '@guaranix/ui';
import { useBoxClock } from '@guaranix/ui/data';
import { NavLink } from 'react-router';
import { NAV_ITEMS } from './nav-items';

/**
 * Tablets get a narrow rail of icons with labels under them; desktops a full
 * sidebar with the box name. Phones use the bottom tabs.
 */
export function SideRail() {
  const { boxName } = useBoxClock();
  return (
    <aside className="sticky top-0 hidden h-dvh w-24 shrink-0 flex-col items-center gap-8 border-r border-border bg-surface py-6 md:flex lg:w-60 lg:items-stretch lg:px-4">
      <div className="flex items-center gap-3 lg:px-2">
        <BoxMark name={boxName ?? ''} />
        <span className="hidden min-w-0 flex-col lg:flex">
          <span className="line-clamp-2 font-display leading-tight font-bold">{boxName}</span>
          <span className="text-xs text-text-secondary">{t('app.name')}</span>
        </span>
      </div>
      <nav aria-label={t('member.nav.label')} className="w-full">
        <ul className="flex flex-col gap-1 px-2 lg:px-0">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  classNames(
                    'flex min-h-touch flex-col items-center justify-center gap-1 rounded-lg py-2 text-micro font-semibold',
                    'transition-press active:scale-98 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm',
                    isActive
                      ? 'bg-accent text-on-accent'
                      : 'text-text-secondary hover:bg-surface-sunken hover:text-text',
                  )
                }
              >
                <Icon aria-hidden="true" size={21} strokeWidth={1.75} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
