import { formatGuarani, formatGuaraniCompact, t } from '@guaranix/shared';
import { Skeleton, StatTile } from '@guaranix/ui';
import { useMetrics } from '../../api/queries';

/** The four numbers the GuaraniX owner checks first (PRD: MRR, active and trial boxes). */
export function MetricsRow() {
  const { data: metrics } = useMetrics();
  if (!metrics) {
    return (
      <div aria-busy="true" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }
  const { boxes } = metrics;
  return (
    <section
      aria-label={t('platform.metrics.label')}
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      <StatTile
        value={
          <span
            title={formatGuarani(metrics.mrrGs)}
            className="text-2xl whitespace-nowrap sm:text-3xl"
          >
            {formatGuaraniCompact(metrics.mrrGs)}
          </span>
        }
        label={t('platform.metrics.mrr')}
        hint={t('platform.metrics.mrrHint', { amount: formatGuaraniCompact(metrics.trialMrrGs) })}
      />
      <StatTile
        value={boxes.active}
        label={t('platform.metrics.activeBoxes')}
        hint={t('platform.metrics.activeBoxesHint', {
          trial: boxes.trial,
          extra: boxes.withExtraLocations,
        })}
      />
      <StatTile
        value={metrics.activeMembers.toLocaleString('es-PY')}
        label={t('platform.metrics.members')}
        hint={t('platform.metrics.membersHint')}
      />
      <StatTile
        value={boxes.trialEndingSoon + boxes.suspended}
        label={t('platform.metrics.attention')}
        hint={t('platform.metrics.attentionHint', {
          ending:
            boxes.trialEndingSoon === 1
              ? t('platform.metrics.trialsEndingOne')
              : t('platform.metrics.trialsEnding', { count: boxes.trialEndingSoon }),
          suspended:
            boxes.suspended === 1
              ? t('platform.metrics.suspendedOne')
              : t('platform.metrics.suspended', { count: boxes.suspended }),
        })}
      />
    </section>
  );
}
