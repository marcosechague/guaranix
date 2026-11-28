import { formatDuration, t } from '@guaranix/shared';
import { Card, IconButton, Page, QrCode, Skeleton, useWakeLock } from '@guaranix/ui';
import { LoadError, useBoxClock, useNow } from '@guaranix/ui/data';
import { useSession } from '@guaranix/ui/auth';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useCheckInPass, useMe } from '../../api/queries';

/** Seconds left on the pass, ticking once a second. */
function useSecondsLeft(expiresAt: string | undefined) {
  const now = useNow(1000);
  if (!expiresAt) return null;
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 1000));
}

function PassBody() {
  const pass = useCheckInPass();
  const secondsLeft = useSecondsLeft(pass.data?.expiresAt);
  if (pass.isPending) return <Skeleton className="aspect-square w-full rounded-lg" />;
  if (pass.isError && !pass.data) {
    return <LoadError error={pass.error} onRetry={() => void pass.refetch()} />;
  }
  if (!pass.data) return null;
  return (
    <>
      <QrCode value={pass.data.pass} label={t('member.checkIn.qrLabel')} className="w-full" />
      <p className="text-center text-sm text-text-secondary tabular-nums" aria-live="off">
        {t('member.checkIn.renews', { time: formatDuration(secondsLeft ?? 0) })}
      </p>
    </>
  );
}

/**
 * Full screen, no tab bar: the member hands the phone to the entrance
 * scanner, so the code is as big as the screen allows and the screen stays on.
 */
export function CheckInPassScreen() {
  const navigate = useNavigate();
  const session = useSession();
  const { boxName } = useBoxClock();
  const { data: me } = useMe();
  useWakeLock(true);
  const name = me ? `${me.firstName} ${me.lastName}` : session.user.fullName;
  return (
    <Page layout="centered" className="items-stretch">
      <header className="flex items-center gap-3">
        <IconButton label={t('member.checkIn.close')} onClick={() => void navigate('/')}>
          <X aria-hidden="true" size={20} />
        </IconButton>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold tracking-widest text-text-secondary uppercase">
            {boxName ?? t('app.name')}
          </p>
          <h1 className="truncate font-display text-xl font-bold">{t('member.checkIn.title')}</h1>
        </div>
      </header>
      <Card className="items-center">
        <p className="text-center font-display text-2xl font-bold">{name}</p>
        <PassBody />
      </Card>
      <p className="text-center text-text-soft">{t('member.checkIn.hint')}</p>
    </Page>
  );
}
