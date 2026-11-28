import { formatDuration, type CheckInPassView } from '@guaranix/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { Card } from '../components/Card';
import { FullScreenHeader } from '../components/FullScreenHeader';
import { Page } from '../components/Page';
import { QrCode } from '../components/QrCode';
import { Skeleton } from '../components/Skeleton';
import { useWakeLock } from '../lib/use-wake-lock';
import { LoadError } from './LoadError';
import { useNow } from './use-now';

/** Seconds left on the pass, ticking once a second. */
function useSecondsLeft(expiresAt: string | undefined) {
  const now = useNow(1000);
  if (!expiresAt) return null;
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 1000));
}

interface PassBodyProps {
  pass: UseQueryResult<CheckInPassView>;
  qrLabel: string;
  renewsLabel: (time: string) => string;
}

function PassBody({ pass, qrLabel, renewsLabel }: PassBodyProps) {
  const secondsLeft = useSecondsLeft(pass.data?.expiresAt);
  if (pass.isPending) return <Skeleton className="aspect-square w-full rounded-lg" />;
  if (pass.isError && !pass.data) {
    return <LoadError error={pass.error} onRetry={() => void pass.refetch()} />;
  }
  if (!pass.data) return null;
  return (
    <>
      <QrCode value={pass.data.pass} label={qrLabel} className="w-full" />
      <p className="text-center text-sm text-text-secondary tabular-nums" aria-live="off">
        {renewsLabel(formatDuration(secondsLeft ?? 0))}
      </p>
    </>
  );
}

export interface PassScreenProps extends PassBodyProps {
  eyebrow: string;
  title: string;
  closeLabel: string;
  onClose: () => void;
  /** Whose pass it is, big, so the person at the entrance can tell at a glance. */
  name: string;
  hint: string;
}

/**
 * Full screen, no tab bar: the person shows the phone to the entrance
 * scanner, so the code is as big as the screen allows and the screen stays on.
 */
export function PassScreen({
  eyebrow,
  title,
  closeLabel,
  onClose,
  name,
  hint,
  ...body
}: PassScreenProps) {
  useWakeLock(true);
  return (
    <Page layout="centered" className="items-stretch">
      <FullScreenHeader eyebrow={eyebrow} title={title} closeLabel={closeLabel} onClose={onClose} />
      <Card className="items-center">
        <p className="text-center font-display text-2xl font-bold">{name}</p>
        <PassBody {...body} />
      </Card>
      <p className="text-center text-text-soft">{hint}</p>
    </Page>
  );
}
