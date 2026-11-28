import type { BoxRole, Session } from '@guaranix/shared';
import { AuthGate, AuthProvider } from '@guaranix/ui/auth';
import { ApiProvider } from '@guaranix/ui/data';
import { lazy, Suspense } from 'react';
import { RouterProvider } from 'react-router';
import { API_URL } from './config';
import { PageSkeleton } from './layout/PageSkeleton';
import { router } from './router';

const STAFF_ROLES: readonly BoxRole[] = ['box_owner', 'box_admin', 'coach', 'reception'];

/**
 * The panel is for staff of the active box, or a GuaraniX admin looking at it
 * read-only ("entrar como"). The API enforces both again on every route.
 */
function hasStaffBox(session: Session): boolean {
  if (session.impersonation) return true;
  return session.memberships.some(
    (membership) =>
      membership.boxId === session.activeBoxId && STAFF_ROLES.includes(membership.role),
  );
}

// Separate chunk: staff never download the sign-up, new owners never download the panel.
const BoxOnboarding = lazy(() =>
  import('./onboarding').then((module) => ({ default: module.BoxOnboarding })),
);

export function App() {
  return (
    <AuthProvider apiUrl={API_URL}>
      <AuthGate>
        {(session) =>
          hasStaffBox(session) ? (
            <ApiProvider apiUrl={API_URL}>
              <RouterProvider router={router} />
            </ApiProvider>
          ) : (
            <ApiProvider apiUrl={API_URL}>
              <Suspense fallback={<PageSkeleton />}>
                <BoxOnboarding />
              </Suspense>
            </ApiProvider>
          )
        }
      </AuthGate>
    </AuthProvider>
  );
}
