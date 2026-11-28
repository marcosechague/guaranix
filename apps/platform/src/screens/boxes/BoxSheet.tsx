import { formatGuarani, t } from '@guaranix/shared';
import { Badge, Button, Eyebrow, Sheet, Skeleton, useToast } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { LogIn } from 'lucide-react';
import { useBox, useBoxMutations } from '../../api/queries';
import { formatInstantDate, STATUS_TONES, statusLabel, trialLabel } from '../../lib/box-status';
import type { ReasonAction } from './BoxActionSheet';
import { BoxActivity } from './BoxActivity';
import { BoxBillingForm } from './BoxBillingForm';
import { BoxFeaturesSection } from './BoxFeaturesSection';

export interface BoxSheetProps {
  boxId: string | null;
  onClose: () => void;
  onAction: (action: ReasonAction, box: { id: string; name: string }) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <Eyebrow>{title}</Eyebrow>
      {children}
    </section>
  );
}

/** Everything about one box: owner, what it pays, its history and the platform actions. */
export function BoxSheet({ boxId, onClose, onAction }: BoxSheetProps) {
  const toast = useToast();
  const { data } = useBox(boxId);
  const { changeStatus } = useBoxMutations(boxId ?? '');
  const box = data?.box;
  const trial = box ? trialLabel(box, new Date()) : null;

  async function reactivate() {
    if (!box) return;
    await changeStatus.mutateAsync({ action: 'reactivate' });
    toast.show(t('platform.statusChange.reactivate.done', { name: box.name }), 'success');
  }

  return (
    <Sheet
      open={boxId !== null}
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title={box?.name ?? '…'}
      {...(box ? { description: t(`platform.businessTypes.${box.businessType}`) } : {})}
      closeLabel={t('platform.box.close')}
    >
      {!box || !data ? (
        <div aria-busy="true" className="flex flex-col gap-4">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-7">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONES[box.status]} dot>
              {statusLabel(box.status)}
            </Badge>
            {trial ? <span className="text-sm text-text-secondary">{trial}</span> : null}
            <span className="text-sm text-text-secondary">
              · {t('platform.box.since', { date: formatInstantDate(box.createdAt) })}
            </span>
          </div>
          {box.statusReason && box.status !== 'active' && box.status !== 'trial' ? (
            <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
              {t('platform.box.statusReason', { reason: box.statusReason })}
            </p>
          ) : null}

          <Section title={t('platform.box.owner')}>
            {box.owner ? (
              <p className="flex flex-col">
                <span className="font-semibold">{box.owner.fullName}</span>
                <span className="text-sm text-text-secondary">{box.owner.email}</span>
              </p>
            ) : (
              <p className="text-sm text-text-secondary">{t('platform.box.noOwner')}</p>
            )}
          </Section>

          <Section title={t('platform.box.billing')}>
            <p className="font-display text-2xl font-bold tabular-nums">
              {t('platform.box.monthlyFee', { amount: formatGuarani(box.monthlyFeeGs) })}
            </p>
            <BoxBillingForm
              key={`${box.id}-${box.platformPlan?.id}-${box.extraLocations}`}
              box={box}
            />
          </Section>

          <BoxFeaturesSection boxId={box.id} />

          <Section title={t('platform.box.actions')}>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={box.status === 'cancelled'}
                onClick={() => onAction('impersonate', box)}
              >
                <LogIn aria-hidden="true" size={18} />
                {t('platform.box.enterAs')}
              </Button>
              {box.status === 'suspended' || box.status === 'cancelled' ? (
                <Button
                  variant="secondary"
                  disabled={changeStatus.isPending}
                  onClick={() =>
                    void reactivate().catch((error: unknown) =>
                      toast.show(errorText(error), 'error'),
                    )
                  }
                >
                  {t('platform.box.reactivate')}
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => onAction('suspend', box)}>
                  {t('platform.box.suspend')}
                </Button>
              )}
              {box.status !== 'cancelled' ? (
                <Button
                  variant="ghost"
                  className="text-warning"
                  onClick={() => onAction('remove', box)}
                >
                  {t('platform.box.remove')}
                </Button>
              ) : null}
            </div>
          </Section>

          <Section title={t('platform.box.activity')}>
            <BoxActivity activity={data.activity} />
          </Section>
        </div>
      )}
    </Sheet>
  );
}
