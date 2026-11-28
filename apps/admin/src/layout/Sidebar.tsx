import { t } from '@guaranix/shared';
import { classNames } from '@guaranix/ui';
import { useBoxClock } from '@guaranix/ui/data';
import { Settings, UserRound } from 'lucide-react';
import { NavLink } from 'react-router';
import { BoxMark } from './BoxMark';
import { NAV_ITEMS } from './nav-items';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  classNames(
    'flex min-h-touch items-center gap-3 rounded-md px-3 text-sm font-semibold',
    'transition-press active:scale-98',
    isActive ? 'bg-text text-background' : 'text-text-soft hover:bg-surface-sunken hover:text-text',
  );

export function Sidebar() {
  const { boxName } = useBoxClock();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-border bg-surface px-4 py-6 md:flex">
      <div className="flex items-center gap-3 px-2">
        <BoxMark name={boxName ?? ''} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-display font-bold">{boxName}</span>
          <span className="text-xs text-text-secondary">{t('app.name')}</span>
        </div>
      </div>
      <nav aria-label={t('admin.nav.label')} className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={linkClass}>
            <Icon aria-hidden="true" size={19} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="flex flex-col gap-1">
        <NavLink to="/ajustes" className={linkClass}>
          <Settings aria-hidden="true" size={19} strokeWidth={1.75} />
          {t('admin.nav.settings')}
        </NavLink>
        <NavLink to="/cuenta" className={linkClass}>
          <UserRound aria-hidden="true" size={19} strokeWidth={1.75} />
          {t('admin.nav.account')}
        </NavLink>
      </div>
    </aside>
  );
}
