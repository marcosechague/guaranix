import { t } from '@guaranix/shared';
import {
  BoxMark,
  GuaranixLogo,
  classNames,
  NavCollapseButton,
  ThemeToggleButton,
  useStoredFlag,
} from '@guaranix/ui';
import { useBoxClock } from '@guaranix/ui/data';
import { type LucideIcon, Settings, UserRound } from 'lucide-react';
import { NavLink } from 'react-router';
import { canManage } from '../lib/roles';
import { BRODI_NAV_ITEM, NAV_ITEMS } from './nav-items';

const FOOTER_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/ajustes', label: t('admin.nav.settings'), icon: Settings },
  { to: '/cuenta', label: t('admin.nav.account'), icon: UserRound },
];

function SidebarLink({
  to,
  label,
  icon: Icon,
  collapsed,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  collapsed: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      // Collapsed, the label is only for screen readers; the tooltip names the icon.
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        classNames(
          'flex min-h-touch items-center gap-3 rounded-md text-sm font-semibold',
          'transition-press active:scale-98',
          collapsed ? 'justify-center px-0' : 'px-3',
          isActive
            ? 'bg-text text-background'
            : 'text-text-soft hover:bg-surface-sunken hover:text-text',
        )
      }
    >
      <Icon aria-hidden="true" size={19} strokeWidth={1.75} />
      <span className={collapsed ? 'sr-only' : undefined}>{label}</span>
    </NavLink>
  );
}

export function Sidebar() {
  const { boxName, role } = useBoxClock();
  const items = canManage(role) ? [...NAV_ITEMS, BRODI_NAV_ITEM] : NAV_ITEMS;
  const [collapsed, setCollapsed] = useStoredFlag('gx-admin-nav-collapsed');
  return (
    <aside
      className={classNames(
        'sticky top-0 hidden h-dvh shrink-0 flex-col gap-6 border-r border-border bg-surface py-6 md:flex',
        collapsed ? 'w-20 px-3' : 'w-64 px-4',
      )}
    >
      <div className={classNames('flex items-center gap-3', collapsed ? 'flex-col' : 'px-2')}>
        <BoxMark name={boxName ?? ''} />
        {collapsed ? (
          <GuaranixLogo variant="mark" size="small" />
        ) : (
          <div className="flex min-w-0 flex-col">
            <span className="line-clamp-2 font-display leading-tight font-bold">{boxName}</span>
            <GuaranixLogo size="small" className="mt-1 self-start" />
          </div>
        )}
      </div>
      <nav aria-label={t('admin.nav.label')} className="flex flex-1 flex-col gap-1">
        {items.map((item) => (
          <SidebarLink key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>
      <div className="flex flex-col gap-1">
        {FOOTER_ITEMS.map((item) => (
          <SidebarLink key={item.to} {...item} collapsed={collapsed} />
        ))}
        <div
          className={classNames(
            'mt-2 flex gap-1 border-t border-divider pt-3',
            collapsed ? 'flex-col items-center' : 'items-center justify-between px-1',
          )}
        >
          <ThemeToggleButton />
          <NavCollapseButton collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        </div>
      </div>
    </aside>
  );
}
