import { type Session, t } from '@guaranix/shared';
import { Brodi, Button, Card, Page, PageHeader } from '@guaranix/ui';
import { AccountSecurity, AuthGate, AuthProvider } from '@guaranix/ui/auth';
import { API_URL } from './config';

function NoBoxYet({ session }: { session: Session }) {
  return (
    <Card spacing="compact">
      <h2 className="font-display text-lg font-bold">{t('auth.noBox.title')}</h2>
      <p className="text-text-secondary">
        {t('auth.noBox.subtitle', { email: session.user.email ?? '' })}
      </p>
    </Card>
  );
}

function NextClass() {
  return (
    <Card aria-labelledby="next-class-title">
      <h2
        id="next-class-title"
        className="text-xs font-semibold tracking-widest text-text-secondary uppercase"
      >
        {t('member.home.nextClass')}
      </h2>
      <div className="flex items-center gap-4">
        <Brodi alt="" size={72} className="shrink-0" />
        <p className="text-text-soft">{t('member.home.emptyNextClass')}</p>
      </div>
      <Button>{t('member.home.bookClass')}</Button>
    </Card>
  );
}

function Home({ session }: { session: Session }) {
  const firstName = session.user.fullName.split(' ')[0] ?? session.user.fullName;
  return (
    <Page layout="mobile">
      <PageHeader eyebrow={t('app.name')} title={t('member.home.greeting', { name: firstName })} />
      {session.activeBoxId ? <NextClass /> : <NoBoxYet session={session} />}
      <AccountSecurity />
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
