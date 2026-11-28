import { formatKilograms, formatShortDate, t } from '@guaranix/shared';
import { Avatar, Badge, Button, Eyebrow, Sheet, Skeleton, useToast } from '@guaranix/ui';
import { errorText, useBoxClock } from '@guaranix/ui/data';
import { useMember, useMemberRecords, useMovements } from '../../api/queries';
import { useUpdateMember } from '../../api/mutations';
import { canFrontDesk } from '../../lib/roles';
import { AssignPlanForm } from './AssignPlanForm';
import { MemberPlansList } from './MemberPlansList';

export interface MemberDetailSheetProps {
  memberId: string | null;
  onClose: () => void;
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-text-secondary">{label}</dt>
      <dd className="font-medium tabular-nums">{value ?? '—'}</dd>
    </div>
  );
}

export function MemberDetailSheet({ memberId, onClose }: MemberDetailSheetProps) {
  const { role } = useBoxClock();
  const member = useMember(memberId);
  const records = useMemberRecords(memberId);
  const movements = useMovements();
  const update = useUpdateMember(memberId ?? '');
  const toast = useToast();
  const data = member.data;
  const frontDesk = canFrontDesk(role);

  const toggleStatus = () =>
    data &&
    update.mutate(
      { status: data.status === 'active' ? 'inactive' : 'active' },
      {
        onSuccess: () => {
          toast.show(t('admin.members.statusChanged'));
          void member.refetch();
        },
        onError: (error) => toast.show(errorText(error), 'error'),
      },
    );

  return (
    <Sheet
      open={memberId !== null}
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      closeLabel={t('common.close')}
      title={data ? `${data.firstName} ${data.lastName}` : t('admin.members.detail')}
      description={
        data ? t('admin.members.joinedOn', { date: formatShortDate(data.joinedOn) }) : undefined
      }
      footer={
        frontDesk && data ? (
          <Button variant="secondary" disabled={update.isPending} onClick={toggleStatus}>
            {data.status === 'active' ? t('admin.members.deactivate') : t('admin.members.activate')}
          </Button>
        ) : undefined
      }
    >
      {!data ? (
        <div aria-busy="true" className="flex flex-col gap-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-32" />
        </div>
      ) : (
        <div className="flex flex-col gap-7">
          <section className="flex items-center gap-4">
            <Avatar
              firstName={data.firstName}
              lastName={data.lastName}
              className="size-14 text-lg"
            />
            <Badge tone={data.status === 'active' ? 'success' : 'outline'} dot>
              {t(`admin.members.status.${data.status}`)}
            </Badge>
          </section>
          <section className="flex flex-col gap-3">
            <Eyebrow>{t('admin.members.contact')}</Eyebrow>
            <dl className="grid grid-cols-2 gap-4">
              {frontDesk ? (
                <Detail label={t('admin.members.document')} value={data.documentNumber} />
              ) : null}
              <Detail label={t('admin.members.columns.phone')} value={data.phone} />
              <Detail label={t('admin.members.email')} value={data.email} />
            </dl>
          </section>
          <section className="flex flex-col gap-3">
            <Eyebrow>{t('admin.members.plans')}</Eyebrow>
            <MemberPlansList memberId={data.id} />
            {frontDesk ? <AssignPlanForm memberId={data.id} /> : null}
          </section>
          <section className="flex flex-col gap-3">
            <Eyebrow>{t('admin.members.records')}</Eyebrow>
            {(records.data ?? []).length === 0 ? (
              <p className="text-sm text-text-secondary">{t('admin.members.noRecords')}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2">
                {(records.data ?? []).slice(0, 6).map((record) => (
                  <li
                    key={record.id}
                    className="flex flex-col rounded-md border border-border px-3 py-2"
                  >
                    <span className="truncate text-xs text-text-secondary">
                      {movements.data?.find((movement) => movement.id === record.movementId)?.name}
                    </span>
                    <span className="font-display text-lg font-bold tabular-nums">
                      {record.loadGrams === null ? record.reps : formatKilograms(record.loadGrams)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Sheet>
  );
}
