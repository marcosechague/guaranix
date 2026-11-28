import { t } from '@guaranix/shared';
import { Button, classNames, GuaranixLogo, ToastProvider } from '@guaranix/ui';
import { useAuth } from '@guaranix/ui/auth';
import { Building2, LogOut, Sparkles, Tags, type LucideIcon } from 'lucide-react';
import { Suspense } from 'react';
import { NavLink, Outlet, ScrollRestoration } from 'react-router';
import { ScreenSkeleton } from './ScreenSkeleton';

const SECTIONS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: t('platform.nav.boxes'), icon: Building2 },
  { to: '/planes', label: t('platform.nav.plans'), icon: Tags },
  { to: '/ia', label: t('platform.nav.ai'), icon: Sparkles },
];

function BrandMark() {
  return (
    <span className="flex items-center gap-2">
      <GuaranixLogo />
      <span className="font-display text-lg font-medium text-text-secondary">
        · {t('platform.brand')}
      </span>
    </span>
  );
}

/** Dark top bar over a light workspace, as in docs/design/Plataforma.html. */
export function PlatformShell() {
  const { client, setSession } = useAuth();
  return (
    <ToastProvider>
      <header data-theme="dark" className="bg-background text-text">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3 md:px-8">
          <BrandMark />
          <div className="flex items-center gap-1">
            <nav aria-label={t('platform.nav.label')}>
              <ul className="flex gap-1">
                {SECTIONS.map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={to === '/'}
                      className={({ isActive }) =>
                        classNames(
                          'flex min-h-touch items-center gap-2 rounded-sm px-3 text-sm font-semibold transition-press active:scale-95',
                          isActive
                            ? 'bg-accent-soft text-accent'
                            : 'text-text-soft hover:text-text',
                        )
                      }
                    >
                      <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            <Button
              variant="ghost"
              aria-label={t('platform.nav.logout')}
              className="px-3 text-text-soft"
              onClick={async () => {
                await client.logout();
                setSession(null);
              }}
            >
              <LogOut aria-hidden="true" size={18} strokeWidth={1.75} />
            </Button>
          </div>
        </div>
      </header>
      <Suspense fallback={<ScreenSkeleton />}>
        <Outlet />
      </Suspense>
      <ScrollRestoration />
    </ToastProvider>
  );
}
