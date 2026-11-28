import { formatGuarani, formatShortDate, t } from '@guaranix/shared';
import type { OwnAccount } from '@guaranix/shared/api';
import { Badge, Button, Card, Eyebrow } from '@guaranix/ui';
import { CircleCheck, Hourglass, Upload } from 'lucide-react';
import { inReviewGs, leftToPayGs, openCharges } from '../../lib/fees';

export interface FeeSummaryCardProps {
  account: OwnAccount;
  today: string;
  onReport: () => void;
}

/** The one thing that matters: how much is left to pay, and the button to report it. */
export function FeeSummaryCard({ account, today, onReport }: FeeSummaryCardProps) {
  const left = leftToPayGs(account);
  const inReview = inReviewGs(account);
  const [oldest] = openCharges(account);

  if (left > 0 && oldest) {
    const overdue = oldest.dueOn < today;
    return (
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>{t('member.fees.toPay')}</Eyebrow>
          {overdue ? (
            <Badge tone="warning" dot>
              {t('member.fees.states.overdue')}
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-display text-5xl leading-none font-bold tabular-nums">
            {formatGuarani(left)}
          </span>
          <span className="text-sm text-text-secondary">
            {t(overdue ? 'member.fees.overdueMeta' : 'member.fees.toPayMeta', {
              description: oldest.description,
              date: formatShortDate(oldest.dueOn),
            })}
            {inReview > 0
              ? ` ${t('member.fees.inReviewExtra', { amount: formatGuarani(inReview) })}`
              : ''}
          </span>
        </div>
        <Button onClick={onReport}>
          <Upload aria-hidden="true" size={18} />
          {t('member.fees.report')}
        </Button>
        <p className="text-sm text-text-secondary">{t('member.fees.reportHint')}</p>
      </Card>
    );
  }

  const reviewing = inReview > 0;
  const Icon = reviewing ? Hourglass : CircleCheck;
  const next = openCharges(account).find((charge) => charge.dueOn >= today);
  return (
    <Card className="flex flex-row items-start gap-4">
      <span
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-success-soft text-success"
      >
        <Icon size={22} strokeWidth={1.75} />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-display text-xl font-bold">
          {t(reviewing ? 'member.fees.inReviewTitle' : 'member.fees.allPaid')}
        </span>
        <span className="text-sm text-text-secondary">
          {reviewing
            ? t('member.fees.inReviewMeta', { amount: formatGuarani(inReview) })
            : next
              ? t('member.fees.nextDue', {
                  amount: formatGuarani(next.outstandingGs),
                  date: formatShortDate(next.dueOn),
                })
              : t('member.fees.allPaidMeta')}
        </span>
      </span>
    </Card>
  );
}
