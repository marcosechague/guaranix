import { formatGuarani, type PlatformBoxSummary, t } from '@guaranix/shared';
import { Button, Card, Eyebrow, useToast } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { useBoxMutations } from '../../api/queries';
import type { ReasonAction } from './BoxActionSheet';
import { BoxBillingForm } from './BoxBillingForm';
import { BoxOwnerSection } from './BoxOwnerSection';

export interface BoxSummaryTabProps {
  box: PlatformBoxSummary;
  onAction: (action: ReasonAction) => void;
}

function BoxStateCard({ box, onAction }: BoxSummaryTabProps) {
  const toast = useToast();
  const { changeStatus } = useBoxMutations(box.id);
  const stopped = box.status === 'suspended' || box.status === 'cancelled';

  async function reactivate() {
    await changeStatus.mutateAsync({ action: 'reactivate' });
    toast.show(t('platform.statusChange.reactivate.done', { name: box.name }), 'success');
  }

  return (
    <Card spacing="compact" className="lg:col-span-2">
      <Eyebrow>{t('platform.box.state')}</Eyebrow>
      <p className="text-sm text-text-secondary">{t('platform.box.stateHint')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {stopped ? (
          <Button
            variant="secondary"
            disabled={changeStatus.isPending}
            onClick={() =>
              void reactivate().catch((error: unknown) => toast.show(errorText(error), 'error'))
            }
          >
            {t('platform.box.reactivate')}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => onAction('suspend')}>
            {t('platform.box.suspend')}
          </Button>
        )}
        {box.status !== 'cancelled' ? (
          <Button variant="ghost" className="text-warning" onClick={() => onAction('remove')}>
            {t('platform.box.remove')}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

/** Owner and what the box pays side by side on wide screens, the status actions last. */
export function BoxSummaryTab({ box, onAction }: BoxSummaryTabProps) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card>
        <Eyebrow>{t('platform.box.owner')}</Eyebrow>
        <BoxOwnerSection box={box} />
      </Card>
      <Card>
        <div className="flex flex-col gap-1">
          <Eyebrow>{t('platform.box.billing')}</Eyebrow>
          <p className="font-display text-2xl font-bold tabular-nums">
            {t('platform.box.monthlyFee', { amount: formatGuarani(box.monthlyFeeGs) })}
          </p>
        </div>
        <BoxBillingForm
          key={`${box.id}-${box.platformPlan?.id}-${box.extraLocations}-${box.trialEndsAt}`}
          box={box}
        />
      </Card>
      <BoxStateCard box={box} onAction={onAction} />
    </div>
  );
}
