import { type BoxRole, type Session, t } from '@guaranix/shared';
import { Page, PageHeader } from '@guaranix/ui';
import { AccountSecurity, AuthGate, AuthProvider } from '@guaranix/ui/auth';
import { API_URL } from './config';

const STAFF_ROLES: readonly BoxRole[] = ['box_owner', 'box_admin', 'coach', 'reception'];

/** The panel is for staff of the active box; the API enforces it again on every route. */
function activeStaffBox(session: Session) {
  return session.memberships.find(
    (membership) =>
      membership.boxId === session.activeBoxId && STAFF_ROLES.includes(membership.role),
  );
}

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

function Home({ session }: { session: Session }) {
  const box = activeStaffBox(session);
  if (!box) return <NoStaffAccess />;
  return (
    <Page layout="panel">
      <PageHeader
        size="large"
        eyebrow={box.boxName}
        title={t('admin.home.title')}
        subtitle={t('admin.home.subtitle')}
      />
      <div className="max-w-md">
        <AccountSecurity />
      </div>
    </Page>
  );
}

export function App() {
  return (
    <AuthProvider apiUrl={API_URL}>
      <AuthGate>{(session) => <Home session={session} />}</AuthGate>
    </AuthProvider>
  );
}
