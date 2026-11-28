import { t } from '@guaranix/shared';
import { Avatar, Page, PageHeader } from '@guaranix/ui';
import { useSession } from '@guaranix/ui/auth';
import { Link } from 'react-router';
import { useMe } from '../../api/queries';
import { useBoxClock } from '@guaranix/ui/data';
import { MembershipRow } from './MembershipRow';
import { NextClassCard } from './NextClassCard';
import { StatsRow } from './StatsRow';
import { TodayWodCard } from './TodayWodCard';

export function HomeScreen() {
  const session = useSession();
  const { boxName } = useBoxClock();
  const { data: me } = useMe();
  const firstName = me?.firstName ?? session.user.fullName.split(' ')[0] ?? '';
  const lastName = me?.lastName ?? '';
  return (
    <Page layout="mobile" className="gap-4">
      <PageHeader
        eyebrow={boxName ?? t('app.name')}
        title={t('member.home.greeting', { name: firstName })}
        actions={
          <Link
            to="/perfil"
            aria-label={t('member.nav.profile')}
            className="rounded-pill transition-press active:scale-95"
          >
            <Avatar firstName={firstName} lastName={lastName} className="size-touch" />
          </Link>
        }
      />
      <NextClassCard />
      <TodayWodCard />
      <StatsRow />
      <MembershipRow />
    </Page>
  );
}
