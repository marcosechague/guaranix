import { formatDuration, formatKilograms, formatShortDate, t } from '@guaranix/shared';
import type { PersonalRecord } from '@guaranix/shared/api';
import { Badge, Button, EmptyState, Page, PageHeader, Skeleton } from '@guaranix/ui';
import { Trophy } from 'lucide-react';
import { Link } from 'react-router';
import { useMovements, useMyRecords } from '../../api/queries';
import { LoadError, useBoxClock } from '@guaranix/ui/data';

function recordValue(record: PersonalRecord): string {
  if (record.loadGrams !== null) return formatKilograms(record.loadGrams);
  if (record.timeSeconds !== null) return formatDuration(record.timeSeconds);
  return String(record.reps ?? 0);
}

/** Best mark per movement and rep max; the API returns them newest first. */
function bestPerMovement(records: readonly PersonalRecord[]): PersonalRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = `${record.movementId}-${record.repMax ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ProgressScreen() {
  const { today } = useBoxClock();
  const records = useMyRecords();
  const movements = useMovements();
  const nameOf = (movementId: string) =>
    movements.data?.find((movement) => movement.id === movementId)?.name ?? '';
  const month = today.slice(0, 7);

  return (
    <Page layout="mobile">
      <PageHeader
        size="large"
        title={t('member.progress.title')}
        subtitle={t('member.progress.subtitle')}
      />
      {records.isPending ? (
        [0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-20 rounded-xl" />)
      ) : records.isError ? (
        <LoadError error={records.error} onRetry={() => void records.refetch()} />
      ) : records.data.length === 0 ? (
        <EmptyState
          framed
          title={t('member.progress.emptyTitle')}
          description={t('member.progress.emptyBody')}
          action={
            <Button asChild>
              <Link to="/wod">{t('member.progress.seeWod')}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3">
          {bestPerMovement(records.data).map((record) => (
            <li
              key={record.id}
              className="flex items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3.5"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-accent-soft text-accent-text">
                <Trophy aria-hidden="true" size={20} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-semibold">{nameOf(record.movementId)}</span>
                <span className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                  {record.repMax ? (
                    <Badge tone="outline" className="px-2 py-0.5 text-tiny">
                      {t('member.progress.repMax', { count: record.repMax })}
                    </Badge>
                  ) : null}
                  {formatShortDate(record.achievedOn)}
                  {record.achievedOn.startsWith(month) ? (
                    <Badge tone="accent" className="px-2 py-0.5 text-tiny">
                      {t('member.progress.newThisMonth')}
                    </Badge>
                  ) : null}
                </span>
              </span>
              <span className="shrink-0 font-display text-2xl font-bold tabular-nums">
                {recordValue(record)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
