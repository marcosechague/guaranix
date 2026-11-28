import type { ReactNode } from 'react';
import { t } from '@guaranix/shared';
import {
  BottomBar,
  BottomBarButton,
  BottomBarTabContent,
  BoxMark,
  Sheet,
  bottomBarTabClasses,
  classNames,
} from '@guaranix/ui';
import { useBoxClock } from '@guaranix/ui/data';
import { Ellipsis, Settings, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { canManage } from '../lib/roles';
import { BRODI_NAV_ITEM, NAV_ITEMS, splitForPhone, type NavItem } from './nav-items';

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

function MoreSheet({
  items,
  open,
  onOpenChange,
}: {
  items: readonly NavItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('admin.nav.more')}
      closeLabel={t('common.close')}
    >
      <ul className="flex flex-col gap-1 p-3 pb-safe">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              onClick={() => onOpenChange(false)}
              className={({ isActive }) =>
                classNames(
                  'flex min-h-touch items-center gap-3 rounded-md px-3 font-semibold transition-press',
                  isActive ? 'bg-accent text-on-accent' : 'text-text hover:bg-surface',
                )
              }
            >
              <Icon aria-hidden="true" size={20} strokeWidth={1.75} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/**
 * Phone navigation: a fixed number of tabs plus "Más" for the rest, so the
 * bar stays on one row however many sections the panel grows.
 */
export function MobileTabBar() {
  const { tabs, more } = splitForPhone(NAV_ITEMS);
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const inMore = more.some((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
  return (
    <BottomBar as="nav" aria-label={t('admin.nav.label')} className="md:hidden">
      <ul className="grid grid-cols-5">
        {tabs.map(({ to, label, icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) => bottomBarTabClasses(isActive)}
            >
              {({ isActive }) => (
                <BottomBarTabContent icon={icon} label={label} active={isActive} />
              )}
            </NavLink>
          </li>
        ))}
        {more.length > 0 ? (
          <li>
            <BottomBarButton
              icon={Ellipsis}
              label={t('admin.nav.more')}
              active={inMore}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(true)}
            />
            <MoreSheet items={more} open={moreOpen} onOpenChange={setMoreOpen} />
          </li>
        ) : null}
      </ul>
    </BottomBar>
  );
}
