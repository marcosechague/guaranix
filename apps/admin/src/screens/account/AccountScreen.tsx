import { t } from '@guaranix/shared';
import { AppearanceCard, NotificationsCard, Page, PageHeader } from '@guaranix/ui';
import { AccountSecurity } from '@guaranix/ui/auth';
import { useBoxClock } from '@guaranix/ui/data';

/** Staff get internal notices on Telegram; the panel has no push service worker. */
const STAFF_TOPICS = ['staff'] as const;
const STAFF_CHANNELS = ['telegram'] as const;

export function AccountScreen() {
  const { boxName } = useBoxClock();
  return (
    <Page layout="panel">
      <PageHeader size="large" eyebrow={boxName} title={t('admin.account.title')} />
      <div className="flex w-full max-w-md flex-col gap-4">
        <AppearanceCard />
        <NotificationsCard topics={STAFF_TOPICS} channels={STAFF_CHANNELS} />
        <AccountSecurity />
      </div>
    </Page>
  );
}
