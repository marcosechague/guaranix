import { t } from '@guaranix/shared';
import {
  BoxMark,
  classNames,
  NavCollapseButton,
  ThemeToggleButton,
  useStoredFlag,
} from '@guaranix/ui';
import { useBoxClock } from '@guaranix/ui/data';
import { NavLink } from 'react-router';
import { NAV_ITEMS } from './nav-items';

/**
 * Tablets get a narrow rail of icons with labels under them; desktops a full
 * sidebar with the box name, which can be collapsed back to the rail. Phones
 * use the bottom tabs.
 */
export function SideRail() {
  const { boxName } = useBoxClock();
  const [collapsed, setCollapsed] = useStoredFlag('gx-member-nav-collapsed');
  // Only desktops expand; `wide` adds the lg: classes that turn the rail into a sidebar.
  const wide = (classes: string) => (collapsed ? '' : classes);
  return (
    <aside
      className={classNames(
        'sticky top-0 hidden h-dvh w-24 shrink-0 flex-col items-center gap-8 border-r border-border bg-surface py-6 md:flex',
        wide('lg:w-60 lg:items-stretch lg:px-4'),
      )}
    >
      <div className={classNames('flex items-center gap-3', wide('lg:px-2'))}>
        <BoxMark name={boxName ?? ''} />
        <span className={classNames('hidden min-w-0 flex-col', wide('lg:flex'))}>
          <span className="line-clamp-2 font-display leading-tight font-bold">{boxName}</span>
          <span className="text-xs text-text-secondary">{t('app.name')}</span>
        </span>
      </div>
      <nav aria-label={t('member.nav.label')} className="w-full flex-1">
        <ul className={classNames('flex flex-col gap-1 px-2', wide('lg:px-0'))}>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  classNames(
                    'flex min-h-touch flex-col items-center justify-center gap-1 rounded-lg py-2 text-micro font-semibold',
                    'transition-press active:scale-98',
                    wide('lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm'),
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
      <div
        className={classNames(
          'flex flex-col items-center gap-1 border-t border-divider pt-3',
          wide('lg:flex-row lg:justify-between lg:px-1'),
        )}
      >
        <ThemeToggleButton />
        {/* Tablets always show the rail; collapsing is a desktop choice. */}
        <div className="hidden lg:block">
          <NavCollapseButton collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        </div>
      </div>
    </aside>
  );
}
