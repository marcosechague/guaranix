import { formatDayMonth, t, weekdayLong } from '@guaranix/shared';
import { Button, Page, PageHeader } from '@guaranix/ui';
import { useSession } from '@guaranix/ui/auth';
import { useBoxClock } from '@guaranix/ui/data';
import { CalendarPlus, UserPlus } from 'lucide-react';
import { Link } from 'react-router';
import { canFrontDesk, canManage } from '../../lib/roles';
import { BrodiHomeCard } from './BrodiHomeCard';
import { DebtorsCard } from './DebtorsCard';
import { KpiRow } from './KpiRow';
import { TodayClassesCard } from './TodayClassesCard';
import { TodayWodCard } from './TodayWodCard';

export function HomeScreen() {
  const session = useSession();
  const { today, role } = useBoxClock();
  const firstName = session.user.fullName.split(' ')[0] ?? '';
  return (
    <Page layout="panel">
      <PageHeader
        size="large"
        eyebrow={`${weekdayLong(today)} ${formatDayMonth(today)}`}
        title={t('admin.home.greeting', { name: firstName })}
        actions={
          <>
            {canFrontDesk(role) ? (
              <Button asChild variant="secondary">
                <Link to="/alumnos?nuevo=1">
                  <UserPlus aria-hidden="true" size={18} />
                  {t('admin.home.newMember')}
                </Link>
              </Button>
            ) : null}
            <Button asChild>
              <Link to="/wod">
                <CalendarPlus aria-hidden="true" size={18} />
                {t('admin.home.programWod')}
              </Link>
            </Button>
          </>
        }
      />
      <KpiRow showMoney={canManage(role)} />
      <div className="grid gap-6 lg:grid-cols-3">
        <TodayClassesCard className="lg:col-span-2" />
        <div className="flex flex-col gap-6">
          {canManage(role) ? <BrodiHomeCard /> : null}
          <TodayWodCard />
          {canFrontDesk(role) ? <DebtorsCard /> : null}
        </div>
      </div>
    </Page>
  );
}
