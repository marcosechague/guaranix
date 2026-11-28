import { type BoxRole, type Session, t } from '@guaranix/shared';
import { Page, PageHeader } from '@guaranix/ui';
import { AccountSecurity, AuthGate, AuthProvider } from '@guaranix/ui/auth';
import { ApiProvider } from '@guaranix/ui/data';
import { RouterProvider } from 'react-router';
import { API_URL } from './config';
import { router } from './router';

const STAFF_ROLES: readonly BoxRole[] = ['box_owner', 'box_admin', 'coach', 'reception'];

/** The panel is for staff of the active box; the API enforces it again on every route. */
function hasStaffBox(session: Session): boolean {
  return session.memberships.some(
    (membership) =>
      membership.boxId === session.activeBoxId && STAFF_ROLES.includes(membership.role),
  );
}

// The onboarding thread replaces this with <BoxOnboarding session={session} /> for new owners.
function NoStaffAccess() {
  return (
    <Page layout="centered">
      <PageHeader
        title={t('auth.noStaffAccess.title')}
        subtitle={t('auth.noStaffAccess.subtitle')}
      />
      <AccountSecurity />
    </Page>
  );
}

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
            <NoStaffAccess />
          )
        }
      </AuthGate>
    </AuthProvider>
  );
}
