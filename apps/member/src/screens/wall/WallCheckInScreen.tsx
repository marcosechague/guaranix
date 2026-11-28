import { t } from '@guaranix/shared';
import { Button, FullScreenHeader, Page, StatusPanel, type StatusTone } from '@guaranix/ui';
import { errorText, useBoxClock } from '@guaranix/ui/data';
import { MapPin } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { type WallState, useWallCheckIn } from './use-wall-check-in';
import { wallCheckInMessage } from './wall-check-in-message';

interface Content {
  tone: StatusTone;
  title: string;
  detail: string;
}

function contentOf(state: WallState, timeZone: string): Content {
  switch (state.kind) {
    case 'locating':
      return {
        tone: 'neutral',
        title: t('member.wallCheckIn.locating'),
        detail: t('member.wallCheckIn.locatingHint'),
      };
    case 'sending':
      return { tone: 'neutral', title: t('member.wallCheckIn.sending'), detail: '' };
    case 'result':
      return wallCheckInMessage(state.result, timeZone);
    case 'position':
      return {
        tone: 'warning',
        title: t(`member.wallCheckIn.position.${state.problem}.title`),
        detail: t(`member.wallCheckIn.position.${state.problem}.detail`),
      };
    case 'error':
      return {
        tone: 'warning',
        title: t('member.wallCheckIn.denied'),
        detail: errorText(state.error),
      };
  }
}

/**
 * Opened from the poster on the wall with the phone's camera. Checks the
 * member in where they stand; when the phone can't prove it, it sends them
 * to the coach instead of leaving them stuck.
 */
export function WallCheckInScreen() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { boxName, timeZone } = useBoxClock();
  const { state, retry } = useWallCheckIn(code);
  const content = contentOf(state, timeZone);
  const busy = state.kind === 'locating' || state.kind === 'sending';
  const done = state.kind === 'result' && state.result.outcome !== 'denied';
  // Trying again helps with the GPS or the network, not with a fee or a full class.
  const canRetry = state.kind === 'position' || state.kind === 'error';

  return (
    <Page layout="centered" className="items-stretch">
      <FullScreenHeader
        eyebrow={boxName ?? t('app.name')}
        title={t('member.wallCheckIn.title')}
        closeLabel={t('member.wallCheckIn.close')}
        onClose={() => void navigate('/')}
      />
      <StatusPanel
        {...content}
        busy={busy}
        icon={state.kind === 'position' ? MapPin : undefined}
        stateKey={state.kind === 'result' ? state.result.outcome : state.kind}
      />
      {done ? (
        <Button onClick={() => void navigate('/')}>{t('member.wallCheckIn.home')}</Button>
      ) : busy ? null : (
        <>
          {canRetry ? (
            <Button onClick={retry}>{t('member.wallCheckIn.retry')}</Button>
          ) : (
            <Button variant="secondary" onClick={() => void navigate('/')}>
              {t('member.wallCheckIn.home')}
            </Button>
          )}
          <p className="text-center text-sm text-text-secondary">
            {t('member.wallCheckIn.askCoach')}
          </p>
        </>
      )}
    </Page>
  );
}
