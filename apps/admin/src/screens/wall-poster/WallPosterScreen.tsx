import { t } from '@guaranix/shared';
import { Button, GuaranixLogo, QrCode, Skeleton } from '@guaranix/ui';
import { LoadError, useBoxClock } from '@guaranix/ui/data';
import { ArrowLeft, Printer } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { useWallPoster } from '../../api/wall-poster';

const STEPS = ['step1', 'step2', 'step3'] as const;

/**
 * The poster for the wall QR: print it and stick it where members arrive.
 * Always light, because it ends up on white paper.
 */
export function WallPosterScreen() {
  const { locationId = '' } = useParams();
  const navigate = useNavigate();
  const { boxName } = useBoxClock();
  const poster = useWallPoster(locationId);

  return (
    <div data-theme="light" className="min-h-dvh bg-background text-text print:bg-surface">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-4 print:hidden">
        <Button variant="secondary" onClick={() => void navigate('/ajustes')}>
          <ArrowLeft aria-hidden="true" size={18} />
          {t('admin.wallPoster.back')}
        </Button>
        <Button disabled={!poster.data} onClick={() => window.print()}>
          <Printer aria-hidden="true" size={18} />
          {t('admin.wallPoster.print')}
        </Button>
      </div>
      <main className="mx-auto flex max-w-3xl flex-col items-center gap-8 rounded-xl border border-border bg-surface px-8 py-12 text-center print:border-0 print:py-0">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold tracking-widest text-text-secondary uppercase">
            {boxName}
            {poster.data ? ` · ${poster.data.locationName}` : ''}
          </p>
          <h1 className="font-display text-5xl font-bold md:text-6xl">
            {t('admin.wallPoster.title')}
          </h1>
          <p className="text-xl text-text-soft">{t('admin.wallPoster.subtitle')}</p>
        </div>
        {poster.isPending ? (
          <Skeleton className="aspect-square w-full max-w-md rounded-lg" />
        ) : poster.isError ? (
          <LoadError error={poster.error} onRetry={() => void poster.refetch()} />
        ) : (
          <QrCode
            value={poster.data.url}
            label={t('admin.wallPoster.qrLabel')}
            className="w-full max-w-md"
          />
        )}
        <ol className="flex w-full max-w-xl flex-col gap-3 text-left text-lg">
          {STEPS.map((step, index) => (
            <li key={step} className="flex items-start gap-4">
              {/* ui-reuse-ignore: a round step number on paper, not the box's square mark. */}
              <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-accent font-display text-xl font-bold text-on-accent">
                {index + 1}
              </span>
              <span className="pt-1.5">{t(`admin.wallPoster.${step}`)}</span>
            </li>
          ))}
        </ol>
        <p className="text-text-secondary">{t('admin.wallPoster.footer')}</p>
        <GuaranixLogo variant="wordmark" size="small" />
      </main>
    </div>
  );
}
