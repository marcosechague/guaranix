import type { ReactNode } from 'react';
import { t } from '@guaranix/shared';
import { classNames } from '@guaranix/ui';
import { useBoxClock } from '@guaranix/ui/data';
import { Settings, UserRound } from 'lucide-react';
import { Link, NavLink } from 'react-router';
import { BoxMark } from './BoxMark';
import { NAV_ITEMS } from './nav-items';

function TopBarLink({ to, label, children }: { to: string; label: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="flex size-touch items-center justify-center rounded-pill border border-border bg-surface"
    >
      {children}
    </Link>
  );
}

export function MobileTopBar() {
  const { boxName } = useBoxClock();
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <BoxMark name={boxName ?? ''} />
        <span className="truncate font-display font-bold">{boxName}</span>
      </div>
      <div className="flex items-center gap-2">
        <TopBarLink to="/ajustes" label={t('admin.nav.settings')}>
          <Settings aria-hidden="true" size={20} />
        </TopBarLink>
        <TopBarLink to="/cuenta" label={t('admin.nav.account')}>
          <UserRound aria-hidden="true" size={20} />
        </TopBarLink>
      </div>
    </header>
  );
}

export function MobileTabBar() {
  return (
    <nav
      aria-label={t('admin.nav.label')}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-safe md:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                classNames(
                  'flex min-h-16 flex-col items-center justify-center gap-1 text-micro font-semibold',
                  isActive ? 'text-text' : 'text-text-secondary',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={classNames(
                      'flex h-7 w-12 items-center justify-center rounded-pill',
                      isActive && 'bg-accent text-on-accent',
                    )}
                  >
                    <Icon aria-hidden="true" size={19} strokeWidth={1.75} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
