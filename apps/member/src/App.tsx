import { t } from '@guaranix/shared';
import { Brodi, Button } from '@guaranix/ui';

export function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-5 pt-7 pb-4">
      <header className="flex flex-col gap-0.5">
        <span className="text-sm text-text-secondary">{t('app.name')}</span>
        <h1 className="font-display text-2xl font-bold">
          {t('member.home.greeting', { name: 'Daniel' })}
        </h1>
      </header>

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
    </main>
  );
}
