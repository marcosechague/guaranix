import { t } from '@guaranix/shared';
import { createApiClient } from '@guaranix/shared/api';
import { LifeBuoy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/Button';
import { useAuth } from './AuthProvider';

export interface ImpersonationBannerProps {
  apiUrl: string;
  /** Where to go after leaving, usually the platform app. */
  onExit?: () => void;
}

const timeFormat = new Intl.DateTimeFormat('es-PY', {
  hour: '2-digit',
  minute: '2-digit',
  // 24-hour clock, as everywhere else in the apps ("hasta las 14:30", not "2:30 p. m.").
  hourCycle: 'h23',
  timeZone: 'America/Asuncion',
});

/**
 * Always-visible strip while a GuaraniX admin works "as" a box, so nobody
 * forgets they are inside someone else's data. Renders nothing otherwise.
 */
export function ImpersonationBanner({ apiUrl, onExit }: ImpersonationBannerProps) {
  const { session, client, setSession } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const impersonation = session?.impersonation;
  if (!session || !impersonation) return null;

  async function leave() {
    if (!session) return;
    setLeaving(true);
    const api = createApiClient({ baseUrl: apiUrl, getCsrfToken: () => session.csrfToken });
    try {
      await api.post('/platform/impersonation/end');
      setSession(await client.getSession());
      onExit?.();
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div
      role="status"
      data-theme="dark"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-background px-4 py-2 text-sm text-text md:px-6"
    >
      <p className="flex items-center gap-2">
        <LifeBuoy aria-hidden="true" size={16} className="shrink-0 text-accent" />
        <span>
          {t('platform.impersonation.banner', {
            box: impersonation.boxName,
            time: timeFormat.format(new Date(impersonation.endsAt)),
          })}
        </span>
      </p>
      <Button variant="secondary" disabled={leaving} onClick={leave}>
        {t('platform.impersonation.leave')}
      </Button>
    </div>
  );
}
