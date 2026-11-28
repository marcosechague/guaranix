import { t } from '@guaranix/shared';
import { useSession } from '@guaranix/ui/auth';
import { PassScreen, useBoxClock } from '@guaranix/ui/data';
import { useNavigate } from 'react-router';
import { useStaffPass } from '../../api/staff-arrivals';

/** A coach or receptionist shows this at the entrance device to log their arrival. */
export function StaffPassScreen() {
  const navigate = useNavigate();
  const session = useSession();
  const { boxName } = useBoxClock();
  const pass = useStaffPass();
  return (
    <PassScreen
      eyebrow={boxName ?? t('app.name')}
      title={t('admin.staffPass.title')}
      closeLabel={t('admin.staffPass.close')}
      onClose={() => void navigate('/')}
      name={session.user.fullName}
      hint={t('admin.staffPass.hint')}
      pass={pass}
      qrLabel={t('admin.staffPass.qrLabel')}
      renewsLabel={(time) => t('admin.staffPass.renews', { time })}
    />
  );
}
