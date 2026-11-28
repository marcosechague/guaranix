import { t } from '@guaranix/shared';
import { Avatar, Page, PageHeader, Columns } from '@guaranix/ui';
import { useSession } from '@guaranix/ui/auth';
import { QrCode as QrCodeIcon } from 'lucide-react';
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
    <Page layout="mobile">
      <PageHeader
        eyebrow={boxName ?? t('app.name')}
        title={t('member.home.greeting', { name: firstName })}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/entrar"
              aria-label={t('member.checkIn.open')}
              title={t('member.checkIn.open')}
              className="inline-flex size-touch items-center justify-center rounded-pill border border-border bg-surface text-text transition-press active:scale-95"
            >
              <QrCodeIcon aria-hidden="true" size={20} />
            </Link>
            <Link
              to="/perfil"
              aria-label={t('member.nav.profile')}
              className="rounded-pill transition-press active:scale-95"
            >
              <Avatar firstName={firstName} lastName={lastName} className="size-touch" />
            </Link>
          </div>
        }
      />
      <Columns
        split="wide-start"
        start={
          <>
            <NextClassCard />
            <TodayWodCard />
          </>
        }
        end={
          <>
            <StatsRow />
            <MembershipRow />
          </>
        }
      />
    </Page>
  );
}
