import { formatShortDate, t } from '@guaranix/shared';
import type { Member } from '@guaranix/shared/api';
import { Avatar, Badge, Button, Card, DividedList, EmptyState, Skeleton } from '@guaranix/ui';
import { LoadError } from '@guaranix/ui/data';
import type { UseQueryResult } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

export interface MembersListProps {
  query: UseQueryResult<Member[]>;
  searching: boolean;
  onCreate: (() => void) | undefined;
}

function StatusBadge({ member }: { member: Member }) {
  return (
    <Badge tone={member.status === 'active' ? 'success' : 'outline'} dot>
      {t(`admin.members.status.${member.status}`)}
    </Badge>
  );
}

/** Table on wide screens, tappable rows on phones; both open the member's sheet. */
export function MembersList({ query, searching, onCreate }: MembersListProps) {
  if (query.isPending) {
    return (
      <Card aria-busy="true">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton key={index} className="h-10" />
        ))}
      </Card>
    );
  }
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data.length === 0) {
    return (
      <EmptyState
        framed
        title={searching ? t('admin.members.emptyTitle') : t('admin.members.noneYetTitle')}
        description={searching ? t('admin.members.emptyBody') : t('admin.members.noneYetBody')}
        action={onCreate ? <Button onClick={onCreate}>{t('admin.members.new')}</Button> : undefined}
      />
    );
  }
  return (
    <>
      <Card className="hidden overflow-hidden p-0 md:flex">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-divider text-text-secondary">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">
                {t('admin.members.columns.name')}
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                {t('admin.members.columns.document')}
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                {t('admin.members.columns.phone')}
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                {t('admin.members.columns.joined')}
              </th>
              <th scope="col" className="px-5 py-3 text-right font-medium">
                {t('admin.members.columns.status')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {query.data.map((member) => (
              <tr key={member.id} className="hover:bg-surface-sunken">
                <td className="px-5 py-3">
                  <Link
                    to={`/alumnos/${member.id}`}
                    className="flex items-center gap-3 font-semibold hover:underline"
                  >
                    <Avatar firstName={member.firstName} lastName={member.lastName} size="sm" />
                    {member.firstName} {member.lastName}
                  </Link>
                </td>
                <td className="px-5 py-3 text-text-soft tabular-nums">
                  {member.documentNumber ?? '—'}
                </td>
                <td className="px-5 py-3 text-text-soft tabular-nums">{member.phone ?? '—'}</td>
                <td className="px-5 py-3 text-text-soft tabular-nums">
                  {formatShortDate(member.joinedOn)}/{member.joinedOn.slice(2, 4)}
                </td>
                <td className="px-5 py-3 text-right">
                  <StatusBadge member={member} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <DividedList className="md:hidden">
        {query.data.map((member) => (
          <li key={member.id}>
            <Link
              to={`/alumnos/${member.id}`}
              className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-surface-sunken"
            >
              <Avatar firstName={member.firstName} lastName={member.lastName} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">
                  {member.firstName} {member.lastName}
                </span>
                <span className="truncate text-sm text-text-secondary">
                  {member.phone ?? t('admin.members.noPhone')}
                </span>
              </span>
              <StatusBadge member={member} />
              <ChevronRight aria-hidden="true" size={18} className="text-text-secondary" />
            </Link>
          </li>
        ))}
      </DividedList>
    </>
  );
}
