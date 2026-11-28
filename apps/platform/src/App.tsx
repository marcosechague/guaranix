import { t } from '@guaranix/shared';
import { Button, Page, PageHeader } from '@guaranix/ui';
import { AuthGate, AuthProvider, useAuth } from '@guaranix/ui/auth';
import { ApiProvider } from '@guaranix/ui/data';
import { RouterProvider } from 'react-router';
import { API_URL } from './config';
import { router } from './router';

/** Box owners and members who land here: the API would refuse them anyway. */
function NoPlatformAccess() {
  const { client, setSession } = useAuth();
  return (
    <Page layout="centered">
      <PageHeader title={t('platform.noAccess.title')} subtitle={t('platform.noAccess.subtitle')} />
      <Button
        variant="secondary"
        onClick={async () => {
          await client.logout();
          setSession(null);
        }}
      >
        {t('platform.nav.logout')}
      </Button>
    </Page>
  );
}

export function App() {
  return (
    <AuthProvider apiUrl={API_URL}>
      <AuthGate>
        {(session) =>
          session.user.isPlatformAdmin ? (
            <ApiProvider apiUrl={API_URL}>
              <RouterProvider router={router} />
            </ApiProvider>
          ) : (
            <NoPlatformAccess />
          )
        }
      </AuthGate>
    </AuthProvider>
  );
}
