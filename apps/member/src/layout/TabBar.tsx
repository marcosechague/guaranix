import { t } from '@guaranix/shared';
import { classNames } from '@guaranix/ui';
import {
  CalendarDays,
  Dumbbell,
  House,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { NavLink } from 'react-router';

const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: t('member.nav.home'), icon: House },
  { to: '/reservar', label: t('member.nav.book'), icon: CalendarDays },
  { to: '/wod', label: t('member.nav.wod'), icon: Dumbbell },
  { to: '/progreso', label: t('member.nav.progress'), icon: TrendingUp },
  { to: '/perfil', label: t('member.nav.profile'), icon: UserRound },
];

export function TabBar() {
  return (
    <nav
      aria-label={t('member.nav.label')}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-safe backdrop-blur"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                classNames(
                  'flex min-h-16 flex-col items-center justify-center gap-1 text-micro font-semibold',
                  'transition-press active:scale-95',
                  isActive ? 'text-accent-text' : 'text-text-secondary hover:text-text',
                )
              }
            >
              <Icon aria-hidden="true" size={22} strokeWidth={1.75} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
