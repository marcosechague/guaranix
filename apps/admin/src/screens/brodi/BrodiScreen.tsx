import { t } from '@guaranix/shared';
import { EmptyState, Page, PageHeader, Skeleton } from '@guaranix/ui';
import { LoadError, useBoxClock } from '@guaranix/ui/data';
import { Lock } from 'lucide-react';
import { useBrodiOverview } from '../../api/brodi';
import { canManage } from '../../lib/roles';
import { BrodiConversation } from './BrodiConversation';
import { WeeklySummaryCard } from './WeeklySummaryCard';

export function BrodiScreen() {
  const { role } = useBoxClock();
  const allowed = canManage(role);
  const overview = useBrodiOverview(allowed);
  return (
    <Page layout="panel">
      <PageHeader title={t('admin.brodi.title')} subtitle={t('admin.brodi.subtitle')} />
      {!allowed ? (
        <EmptyState
          icon={Lock}
          title={t('admin.brodi.managersOnlyTitle')}
          description={t('admin.brodi.managersOnlyBody')}
        />
      ) : overview.isPending ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      ) : overview.isError ? (
        <LoadError error={overview.error} onRetry={() => void overview.refetch()} />
      ) : !overview.data.usage.enabled ? (
        <EmptyState
          icon={Lock}
          title={t('admin.brodi.notIncludedTitle')}
          description={t('admin.brodi.notIncludedBody')}
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <BrodiConversation overview={overview.data} />
          </div>
          <WeeklySummaryCard summary={overview.data.latestSummary} />
        </div>
      )}
    </Page>
  );
}
