import { t } from '@guaranix/shared';
import { Page, PageHeader } from '@guaranix/ui';
import { AccountSecurity } from '@guaranix/ui/auth';
import { useBoxClock } from '@guaranix/ui/data';

export function AccountScreen() {
  const { boxName } = useBoxClock();
  return (
    <Page layout="panel">
      <PageHeader size="large" eyebrow={boxName} title={t('admin.account.title')} />
      <div className="w-full max-w-md">
        <AccountSecurity />
      </div>
    </Page>
  );
}
