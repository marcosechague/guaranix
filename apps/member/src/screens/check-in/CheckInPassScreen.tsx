import { t } from '@guaranix/shared';
import { PassScreen, useBoxClock } from '@guaranix/ui/data';
import { useSession } from '@guaranix/ui/auth';
import { useNavigate } from 'react-router';
import { useCheckInPass, useMe } from '../../api/queries';

/** The member's entry QR, shown to the scanner at the entrance. */
export function CheckInPassScreen() {
  const navigate = useNavigate();
  const session = useSession();
  const { boxName } = useBoxClock();
  const { data: me } = useMe();
  const pass = useCheckInPass();
  return (
    <PassScreen
      eyebrow={boxName ?? t('app.name')}
      title={t('member.checkIn.title')}
      closeLabel={t('member.checkIn.close')}
      onClose={() => void navigate('/')}
      name={me ? `${me.firstName} ${me.lastName}` : session.user.fullName}
      hint={t('member.checkIn.hint')}
      pass={pass}
      qrLabel={t('member.checkIn.qrLabel')}
      renewsLabel={(time) => t('member.checkIn.renews', { time })}
    />
  );
}
