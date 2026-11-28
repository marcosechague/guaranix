import type { ReactNode } from 'react';
import { t } from '@guaranix/shared';
import { BottomBar, BoxMark, classNames } from '@guaranix/ui';
import { useBoxClock } from '@guaranix/ui/data';
import { Settings, UserRound } from 'lucide-react';
import { Link, NavLink } from 'react-router';
import { canManage } from '../lib/roles';
import { BRODI_NAV_ITEM, NAV_ITEMS } from './nav-items';

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
  const { boxName, role } = useBoxClock();
  const BrodiIcon = BRODI_NAV_ITEM.icon;
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <BoxMark name={boxName ?? ''} />
        <span className="truncate font-display font-bold">{boxName}</span>
      </div>
      <div className="flex items-center gap-2">
        {/* The tab bar is full; Brodi lives up here on phones, for managers only. */}
        {canManage(role) ? (
          <TopBarLink to={BRODI_NAV_ITEM.to} label={BRODI_NAV_ITEM.label}>
            <BrodiIcon aria-hidden="true" size={20} />
          </TopBarLink>
        ) : null}
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
    <BottomBar as="nav" aria-label={t('admin.nav.label')} className="md:hidden">
      <ul className="grid grid-cols-6">
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
    </BottomBar>
  );
}
