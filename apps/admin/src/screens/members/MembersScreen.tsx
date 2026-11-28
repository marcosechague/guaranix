import { t } from '@guaranix/shared';
import type { MemberStatus } from '@guaranix/shared/domain';
import { Button, ChipGroup, Page, PageHeader, TextField } from '@guaranix/ui';
import { useBoxClock } from '@guaranix/ui/data';
import { FileUp, UserPlus } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useMemberCount, useMembers } from '../../api/queries';
import { canFrontDesk, canManage } from '../../lib/roles';
import { MemberDetailSheet } from './MemberDetailSheet';
import { MemberFormSheet } from './MemberFormSheet';
import { MembersList } from './MembersList';

type StatusFilter = MemberStatus | 'all';

export function MembersScreen() {
  const { role } = useBoxClock();
  const { memberId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const deferredSearch = useDeferredValue(search.trim());
  const members = useMembers(deferredSearch, status);
  const count = useMemberCount();
  const creating = searchParams.get('nuevo') === '1';

  return (
    <Page layout="panel">
      <PageHeader
        size="large"
        title={t('admin.members.title')}
        subtitle={
          count.data === undefined ? undefined : t('admin.members.subtitle', { count: count.data })
        }
        actions={
          canFrontDesk(role) ? (
            <div className="flex flex-wrap gap-3">
              {canManage(role) ? (
                <Button asChild variant="secondary">
                  <Link to="/importar">
                    <FileUp aria-hidden="true" size={18} />
                    {t('admin.imports.open')}
                  </Link>
                </Button>
              ) : null}
              <Button onClick={() => setSearchParams({ nuevo: '1' })}>
                <UserPlus aria-hidden="true" size={18} />
                {t('admin.members.new')}
              </Button>
            </div>
          ) : null
        }
      />
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <TextField
          className="md:w-96"
          label={
            canFrontDesk(role) ? t('admin.members.search') : t('admin.members.searchNoDocument')
          }
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <ChipGroup
          label={t('admin.members.columns.status')}
          value={status}
          onChange={setStatus}
          options={[
            { value: 'active', label: t('admin.members.filters.active') },
            { value: 'inactive', label: t('admin.members.filters.inactive') },
            { value: 'all', label: t('admin.members.filters.all') },
          ]}
        />
      </div>
      <MembersList
        query={members}
        searching={deferredSearch.length > 0}
        onCreate={canFrontDesk(role) ? () => setSearchParams({ nuevo: '1' }) : undefined}
        showDocument={canFrontDesk(role)}
      />
      <MemberFormSheet
        open={creating}
        onOpenChange={(open) => !open && setSearchParams({})}
        onCreated={(member) => navigate(`/alumnos/${member.id}`)}
      />
      <MemberDetailSheet memberId={memberId ?? null} onClose={() => navigate('/alumnos')} />
    </Page>
  );
}
