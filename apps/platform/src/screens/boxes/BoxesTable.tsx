import { formatGuarani, type PlatformBoxSummary, t } from '@guaranix/shared';
import { Badge, Button, type DataColumn, DataTable } from '@guaranix/ui';
import { LogIn } from 'lucide-react';
import { STATUS_TONES, statusLabel, trialLabel } from '../../lib/box-status';

export interface BoxesTableProps {
  boxes: PlatformBoxSummary[];
  onOpen: (box: PlatformBoxSummary) => void;
  onEnter: (box: PlatformBoxSummary) => void;
}

function StatusCell({ box }: { box: PlatformBoxSummary }) {
  const trial = trialLabel(box, new Date());
  return (
    <span className="flex flex-col items-start gap-1">
      <Badge tone={STATUS_TONES[box.status]} dot>
        {statusLabel(box.status)}
      </Badge>
      {trial ? <span className="text-xs text-text-secondary">{trial}</span> : null}
    </span>
  );
}

function feeHint(box: PlatformBoxSummary) {
  if (box.extraLocations === 0) return null;
  const key = box.extraLocations === 1 ? 'feeExtra' : 'feeExtraPlural';
  return t(`platform.boxes.${key}`, { count: box.extraLocations });
}

export function BoxesTable({ boxes, onOpen, onEnter }: BoxesTableProps) {
  const columns: DataColumn<PlatformBoxSummary>[] = [
    {
      key: 'box',
      header: t('platform.boxes.columns.box'),
      primary: true,
      cell: (box) => (
        <Button
          variant="ghost"
          aria-label={t('platform.boxes.open', { name: box.name })}
          className="min-h-touch flex-col items-start gap-0 px-0 text-left font-semibold hover:bg-transparent hover:underline"
          onClick={() => onOpen(box)}
        >
          <span>{box.name}</span>
          <span className="text-xs font-normal text-text-secondary">
            {t(`platform.businessTypes.${box.businessType}`)}
          </span>
        </Button>
      ),
    },
    {
      key: 'status',
      header: t('platform.boxes.columns.status'),
      bare: true,
      cell: (box) => <StatusCell box={box} />,
    },
    {
      key: 'city',
      header: t('platform.boxes.columns.city'),
      cell: (box) => box.city ?? t('platform.boxes.noCity'),
    },
    {
      key: 'plan',
      header: t('platform.boxes.columns.plan'),
      cell: (box) => box.platformPlan?.name ?? t('platform.boxes.noPlan'),
    },
    {
      key: 'members',
      header: t('platform.boxes.columns.members'),
      cell: (box) => <span className="tabular-nums">{box.activeMembers}</span>,
    },
    {
      key: 'fee',
      header: t('platform.boxes.columns.fee'),
      cell: (box) => (
        <span className="flex flex-col tabular-nums">
          {formatGuarani(box.monthlyFeeGs)}
          {feeHint(box) ? (
            <span className="text-xs text-text-secondary">{feeHint(box)}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('platform.boxes.columns.actions'),
      align: 'end',
      bare: true,
      cell: (box) => (
        <span className="flex justify-end gap-2 max-md:justify-start">
          <Button
            variant="secondary"
            className="text-sm max-md:flex-1"
            disabled={box.status === 'cancelled'}
            onClick={() => onEnter(box)}
          >
            <LogIn aria-hidden="true" size={16} />
            {t('platform.box.enterAs')}
          </Button>
          <Button variant="secondary" className="text-sm max-md:flex-1" onClick={() => onOpen(box)}>
            {t('platform.box.open')}
          </Button>
        </span>
      ),
    },
  ];
  return (
    <DataTable
      caption={t('platform.boxes.title')}
      columns={columns}
      rows={boxes}
      rowKey={(box) => box.id}
    />
  );
}
