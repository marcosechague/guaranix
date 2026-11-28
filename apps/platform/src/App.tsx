import { t } from '@guaranix/shared';
import { Page, PageHeader } from '@guaranix/ui';

export function App() {
  return (
    <Page layout="panel">
      <PageHeader
        size="large"
        title={t('platform.home.title')}
        subtitle={t('platform.home.subtitle')}
      />
    </Page>
  );
}
