import { t } from '@guaranix/shared';
import { classNames } from '@guaranix/ui';
import { NavLink } from 'react-router';
import { NAV_ITEMS } from './nav-items';

/** Bottom tabs on phones; tablets and desktops use the side rail instead. */
export function TabBar() {
  return (
    <nav
      aria-label={t('member.nav.label')}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-safe backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
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
