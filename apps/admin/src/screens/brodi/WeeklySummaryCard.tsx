import {
  formatDayMonth,
  formatGuarani,
  t,
  type BrodiWeeklySummary,
  addDays,
} from '@guaranix/shared';
import { Card, StatTile } from '@guaranix/ui';

/** Last Monday's summary, with the numbers it was written from. */
export function WeeklySummaryCard({ summary }: { summary: BrodiWeeklySummary | null }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold">{t('admin.brodi.weekly.title')}</h2>
        <p className="text-sm text-text-secondary">
          {summary
            ? t('admin.brodi.weekly.range', {
                from: formatDayMonth(summary.weekStart),
                to: formatDayMonth(addDays(summary.weekStart, 6)),
              })
            : t('admin.brodi.weekly.hint')}
        </p>
      </div>
      {summary ? (
        <>
          <p className="text-sm whitespace-pre-line text-text-soft">{summary.summary}</p>
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              className="col-span-2"
              label={t('admin.brodi.weekly.collected')}
              value={formatGuarani(summary.figures.collectedGs)}
            />
            <StatTile
              label={t('admin.brodi.weekly.occupancy')}
              value={
                summary.figures.occupancyRate === null
                  ? '—'
                  : `${Math.round(summary.figures.occupancyRate * 100)}%`
              }
            />
            <StatTile
              label={t('admin.brodi.weekly.active')}
              value={summary.figures.activeMembers}
            />
            <StatTile
              label={t('admin.brodi.weekly.absent')}
              value={summary.figures.absentMembers}
            />
          </div>
        </>
      ) : (
        <p className="text-sm text-text-soft">{t('admin.brodi.weekly.none')}</p>
      )}
    </Card>
  );
}
