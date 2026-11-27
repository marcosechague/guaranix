import { type Session, t } from '@guaranix/shared';
import { Brodi, Button } from '@guaranix/ui';
import { AccountSecurity, AuthGate, AuthProvider } from '@guaranix/ui/auth';
import { API_URL } from './config';

function NoBoxYet({ session }: { session: Session }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5">
      <h2 className="font-display text-lg font-bold">{t('auth.noBox.title')}</h2>
      <p className="text-text-secondary">
        {t('auth.noBox.subtitle', { email: session.user.email ?? '' })}
      </p>
    </section>
  );
}

function Home({ session }: { session: Session }) {
  const firstName = session.user.fullName.split(' ')[0] ?? session.user.fullName;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-5 pt-7 pb-4">
      <header className="flex flex-col gap-0.5">
        <span className="text-sm text-text-secondary">{t('app.name')}</span>
        <h1 className="font-display text-2xl font-bold">
          {t('member.home.greeting', { name: firstName })}
        </h1>
      </header>

      {session.activeBoxId ? (
        <section
          aria-labelledby="next-class-title"
          className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
        >
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
        </section>
      ) : (
        <NoBoxYet session={session} />
      )}

      <AccountSecurity />
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
