import { t } from '@guaranix/shared';

export function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-2 px-6 py-8 md:px-8">
      <h1 className="font-display text-3xl font-bold">{t('platform.home.title')}</h1>
      <p className="text-text-secondary">{t('platform.home.subtitle')}</p>
    </main>
  );
}
