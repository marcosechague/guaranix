import { dateOfInstant, formatGuarani, t } from '@guaranix/shared';
import { Badge, Card, DividedList, Eyebrow, Skeleton } from '@guaranix/ui';
import { LoadError, useBoxClock } from '@guaranix/ui/data';
import { FileSpreadsheet } from 'lucide-react';
import { useImports } from '../../api/imports';
import { formatCalendarDate } from './format';

export function ImportHistory() {
  const imports = useImports();
  const { timeZone } = useBoxClock();

  return (
    <Card>
      <Eyebrow>{t('admin.imports.history.title')}</Eyebrow>
      {imports.isPending ? (
        <Skeleton className="h-16 rounded-md" />
      ) : imports.isError ? (
        <LoadError error={imports.error} onRetry={() => void imports.refetch()} />
      ) : imports.data.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('admin.imports.history.empty')}</p>
      ) : (
        <DividedList>
          {imports.data.map((record) => (
            <li key={record.id} className="flex items-center gap-3 py-3">
              <FileSpreadsheet
                aria-hidden="true"
                size={20}
                className="shrink-0 text-text-secondary"
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{record.fileName}</span>
                <span className="text-sm text-text-secondary">
                  {t('admin.imports.history.summary', {
                    members: record.summary.membersCreated,
                    balance: formatGuarani(record.summary.balanceGs),
                  })}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge tone="outline">{t(`admin.imports.history.sources.${record.source}`)}</Badge>
                <span className="text-xs text-text-secondary tabular-nums">
                  {formatCalendarDate(dateOfInstant(timeZone, record.createdAt))}
                </span>
              </div>
            </li>
          ))}
        </DividedList>
      )}
    </Card>
  );
}
