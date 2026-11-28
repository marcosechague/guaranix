import { type Session, t } from '@guaranix/shared';
import { Card, Page, PageHeader } from '@guaranix/ui';
import { AccountSecurity, AuthGate, AuthProvider } from '@guaranix/ui/auth';
import { ApiProvider, OfflineNotice } from '@guaranix/ui/data';
import { lazy, Suspense } from 'react';
import { RouterProvider } from 'react-router';
import { keepOffline } from './api/keys';
import { API_URL } from './config';
import { router } from './router';

function NoBoxYet({ session }: { session: Session }) {
  const firstName = session.user.fullName.split(' ')[0] ?? session.user.fullName;
  return (
    <Page layout="mobile">
      <PageHeader eyebrow={t('app.name')} title={t('member.home.greeting', { name: firstName })} />
      <Card spacing="compact">
        <h2 className="font-display text-lg font-bold">{t('auth.noBox.title')}</h2>
        <p className="text-text-secondary">
          {t('auth.noBox.subtitle', { email: session.user.email ?? '' })}
        </p>
      </Card>
      <AccountSecurity />
    </Page>
  );
}

// Payment links work without logging in: they open outside the session.
const PayLinkScreen = lazy(async () => ({
  default: (await import('./screens/pay/PayLinkScreen')).PayLinkScreen,
}));

export function App() {
  if (window.location.pathname.startsWith('/pagar/')) {
    return (
      <Suspense fallback={null}>
        <PayLinkScreen />
      </Suspense>
    );
  }
  return (
    <AuthProvider apiUrl={API_URL} offline>
      <AuthGate>
        {(session) =>
          session.activeBoxId ? (
            <ApiProvider apiUrl={API_URL} offlineQueries={keepOffline}>
              <OfflineNotice />
              <RouterProvider router={router} />
            </ApiProvider>
          ) : (
            <NoBoxYet session={session} />
          )
        }
      </AuthGate>
    </AuthProvider>
  );
}
