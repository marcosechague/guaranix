import { ToastProvider } from '@guaranix/ui';
import { motion } from 'motion/react';
import { Suspense } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import { ScreenSkeleton } from './ScreenSkeleton';
import { TabBar } from './TabBar';

export function AppShell() {
  const location = useLocation();
  return (
    <ToastProvider offsetClassName="bottom-tabbar">
      <div className="mx-auto min-h-dvh max-w-md pb-tabbar">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <Suspense fallback={<ScreenSkeleton />}>
            <Outlet />
          </Suspense>
        </motion.div>
      </div>
      <TabBar />
      <ScrollRestoration />
    </ToastProvider>
  );
}
