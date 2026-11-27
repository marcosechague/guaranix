import { type BoxRole, type Session, t } from '@guaranix/shared';
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-5 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold">{t('auth.noStaffAccess.title')}</h1>
        <p className="text-text-secondary">{t('auth.noStaffAccess.subtitle')}</p>
      </header>
      <AccountSecurity />
    </main>
  );
}

function Home({ session }: { session: Session }) {
  const box = activeStaffBox(session);
  if (!box) return <NoStaffAccess />;
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-6 px-6 py-8 md:px-8">
      <header className="flex flex-col gap-2">
        <span className="text-sm text-text-secondary">{box.boxName}</span>
        <h1 className="font-display text-3xl font-bold">{t('admin.home.title')}</h1>
        <p className="text-text-secondary">{t('admin.home.subtitle')}</p>
      </header>
      <div className="max-w-md">
        <AccountSecurity />
      </div>
    </main>
  );
}

export function App() {
  return (
    <AuthProvider apiUrl={API_URL}>
      <AuthGate>{(session) => <Home session={session} />}</AuthGate>
    </AuthProvider>
  );
}
