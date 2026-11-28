import { ToastProvider, useTheme } from '@guaranix/ui';
import { ImpersonationBanner } from '@guaranix/ui/auth';
import { motion } from 'motion/react';
import { Suspense } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import { API_URL, PLATFORM_URL } from '../config';
import { MobileTabBar, MobileTopBar } from './MobileNav';
import { PageSkeleton } from './PageSkeleton';
import { Sidebar } from './Sidebar';

/** Sidebar on wide screens; top bar and bottom tabs on phones. Screens render their own Page. */
export function AppShell() {
  const location = useLocation();
  // Keeps <html data-theme> in step with the stored choice and the system setting.
  useTheme();
  // Animate between sections only; opening /alumnos/:id keeps the list mounted under its sheet.
  const section = location.pathname.split('/')[1] ?? '';
  return (
    <ToastProvider offsetClassName="bottom-tabbar md:bottom-6">
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col pb-tabbar md:pb-0">
          <ImpersonationBanner
            apiUrl={API_URL}
            onExit={() => window.location.assign(PLATFORM_URL)}
          />
          <MobileTopBar />
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </div>
      </div>
      <MobileTabBar />
      <ScrollRestoration />
    </ToastProvider>
  );
}
