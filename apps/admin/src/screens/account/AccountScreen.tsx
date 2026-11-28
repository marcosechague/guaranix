import { t } from '@guaranix/shared';
import { AppearanceCard, Page, PageHeader } from '@guaranix/ui';
import { AccountSecurity } from '@guaranix/ui/auth';
import { useBoxClock } from '@guaranix/ui/data';

export function AccountScreen() {
  const { boxName } = useBoxClock();
  return (
    <Page layout="panel">
      <PageHeader size="large" eyebrow={boxName} title={t('admin.account.title')} />
      <div className="flex w-full max-w-md flex-col gap-4">
        <AppearanceCard />
        <AccountSecurity />
      </div>
    </Page>
  );
}
