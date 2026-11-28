import { t } from '@guaranix/shared';
import { Avatar } from '@guaranix/ui';
import { useSession } from '@guaranix/ui/auth';
import { Link } from 'react-router';
import { useMe } from '../../api/queries';
import { useBoxClock } from '../../lib/use-box-clock';
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
    <main className="flex flex-col gap-4 px-5 pt-7 pb-6">
      <header className="flex items-center justify-between gap-4 pb-1">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm text-text-secondary">{boxName ?? t('app.name')}</span>
          <h1 className="font-display text-2xl font-bold">
            {t('member.home.greeting', { name: firstName })}
          </h1>
        </div>
        <Link
          to="/perfil"
          aria-label={t('member.nav.profile')}
          className="rounded-pill transition-transform duration-fast ease-out active:scale-[0.94]"
        >
          <Avatar firstName={firstName} lastName={lastName} className="size-touch" />
        </Link>
      </header>
      <NextClassCard />
      <TodayWodCard />
      <StatsRow />
      <MembershipRow />
    </main>
  );
}
