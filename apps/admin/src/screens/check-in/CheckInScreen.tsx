import { t } from '@guaranix/shared';
import { Button, Eyebrow, GuaranixLogo, IconButton, useWakeLock } from '@guaranix/ui';
import { useBoxClock } from '@guaranix/ui/data';
import { SwitchCamera, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { CheckInStatusPanel } from './CheckInStatusPanel';
import { RecentCheckIns } from './RecentCheckIns';
import { playEntranceFeedback } from './entrance-feedback';
import { useCheckInDesk } from './use-check-in-desk';
import { type ScannerStatus, useQrScanner } from './use-qr-scanner';

function CameraProblem({ status, onRetry }: { status: ScannerStatus; onRetry: () => void }) {
  if (status !== 'denied' && status !== 'missing') return null;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-surface p-6 text-center">
      <p className="max-w-sm text-text-soft">
        {status === 'denied' ? t('admin.checkIn.cameraDenied') : t('admin.checkIn.cameraMissing')}
      </p>
      <Button variant="secondary" onClick={onRetry}>
        {t('admin.checkIn.retryCamera')}
      </Button>
    </div>
  );
}

/**
 * Entrance mode for a tablet or phone at the door: full screen, camera on,
 * screen always awake. Members hold up their QR and get a green or orange
 * answer; whoever runs the front desk sees it too.
 */
export function CheckInScreen() {
  const navigate = useNavigate();
  const { boxName } = useBoxClock();
  const videoRef = useRef<HTMLVideoElement>(null);
  // A tablet on a stand faces the people coming in: the front camera by default.
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const desk = useCheckInDesk();
  const scanner = useQrScanner(videoRef, facing, desk.onCode);
  useWakeLock(true);

  useEffect(() => {
    if (desk.state.kind === 'result') playEntranceFeedback(desk.state.result.outcome !== 'denied');
    if (desk.state.kind === 'error') playEntranceFeedback(false);
  }, [desk.state]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-5 px-5 py-5 md:px-8">
      <header className="flex items-center gap-3">
        <GuaranixLogo variant="mark" size="small" />
        <div className="min-w-0 flex-1">
          <Eyebrow>{boxName ?? t('admin.checkIn.eyebrow')}</Eyebrow>
          <h1 className="font-display text-2xl font-bold">{t('admin.checkIn.title')}</h1>
        </div>
        <IconButton
          label={t('admin.checkIn.switchCamera')}
          onClick={() => setFacing((current) => (current === 'user' ? 'environment' : 'user'))}
        >
          <SwitchCamera aria-hidden="true" size={20} />
        </IconButton>
        <IconButton label={t('admin.checkIn.exit')} onClick={() => void navigate('/')}>
          <X aria-hidden="true" size={20} />
        </IconButton>
      </header>

      <div className="grid flex-1 content-start gap-5 md:grid-cols-2 md:content-normal">
        <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-surface-sunken md:aspect-auto">
          <video
            ref={videoRef}
            aria-label={t('admin.checkIn.cameraLabel')}
            muted
            playsInline
            className={`size-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-1/5 rounded-xl border-4 border-accent/80"
          />
          <CameraProblem status={scanner.status} onRetry={scanner.retry} />
        </div>
        <div className="flex flex-col gap-5">
          <CheckInStatusPanel state={desk.state} />
          <RecentCheckIns entries={desk.recent} />
        </div>
      </div>
    </main>
  );
}
